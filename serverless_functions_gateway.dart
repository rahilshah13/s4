import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:isolate_manager/isolate_manager.dart';

class TenantTaskRequest {
  final String tenantId;
  final String accessKeyId;
  final String secretAccessKey;
  final String prompt;
  final String taskId;
  final String s4GatewayUrl;

  TenantTaskRequest({
    required this.tenantId,
    required this.accessKeyId,
    required this.secretAccessKey,
    required this.prompt,
    required this.taskId,
    required this.s4GatewayUrl,
  });

  Map<String, dynamic> toJson() => {
        'tenantId': tenantId,
        'accessKeyId': accessKeyId,
        'secretAccessKey': secretAccessKey,
        'prompt': prompt,
        'taskId': taskId,
        's4GatewayUrl': s4GatewayUrl,
      };

  factory TenantTaskRequest.fromJson(Map<String, dynamic> json) => TenantTaskRequest(
        tenantId: json['tenantId'],
        accessKeyId: json['accessKeyId'],
        secretAccessKey: json['secretAccessKey'],
        prompt: json['prompt'],
        taskId: json['taskId'],
        s4GatewayUrl: json['s4GatewayUrl'],
      );
}

class TenantTaskResult {
  final String taskId;
  final String s4ObjectPath;
  final String llmResponse;
  final bool success;
  final String? error;

  TenantTaskResult({
    required this.taskId,
    required this.s4ObjectPath,
    required this.llmResponse,
    required this.success,
    this.error,
  });
}

Future<Map<String, dynamic>> s4LambdaWorker(dynamic rawParams) async {
  final request = TenantTaskRequest.fromJson(Map<String, dynamic>.from(rawParams));

  try {
    final llmOutput = await _stubLlmCall(request.prompt);

    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final objectKey = 'isolates/${request.taskId}-$timestamp';
    final payload = jsonEncode({
      'prompt': request.prompt,
      'response': llmOutput,
      'timestamp': timestamp,
    });

    final uri = Uri.parse('${request.s4GatewayUrl}/buckets/default-functions/keys/$objectKey');
    final response = await http.put(
      uri,
      headers: {
        'X-Tenant-ID': request.tenantId,
        'Authorization': 'S4-HMAC-SHA256 Credential=${request.accessKeyId}',
        'X-S4-Secret': request.secretAccessKey,
        'Content-Type': 'application/json',
      },
      body: payload,
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('S4 Gateway responded with status: ${response.statusCode}, body: ${response.body}');
    }

    return {
      'taskId': request.taskId,
      's4ObjectPath': objectKey,
      'llmResponse': llmOutput,
      'success': true,
    };
  } catch (e) {
    return {
      'taskId': request.taskId,
      's4ObjectPath': '',
      'llmResponse': '',
      'success': false,
      'error': e.toString(),
    };
  }
}

Future<String> _stubLlmCall(String prompt) async {
  await Future.delayed(const Duration(milliseconds: 500));
  return "LLM Processed Result for prompt: '${prompt.substring(0, prompt.length > 30 ? 30 : prompt.length)}...'";
}

class S4ServerlessGateway {
  late final IsolateManager<Map<String, dynamic>, dynamic> _isolatePool;
  final String s4GatewayUrl;

  S4ServerlessGateway({
    this.s4GatewayUrl = 'http://localhost:8080',
    int concurrentWorkers = 4,
  }) {
    _isolatePool = IsolateManager.create(
      s4LambdaWorker,
      concurrent: concurrentWorkers,
      isDebug: false,
    );
  }

  Future<void> initialize() async {
    await _isolatePool.start();
  }

  Future<TenantTaskResult> invokeTask({
    required String tenantId,
    required String accessKeyId,
    required String secretAccessKey,
    required String prompt,
  }) async {
    final taskId = 'task_${DateTime.now().microsecondsSinceEpoch}';
    
    final request = TenantTaskRequest(
      tenantId: tenantId,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      prompt: prompt,
      taskId: taskId,
      s4GatewayUrl: s4GatewayUrl,
    );

    final rawResult = await _isolatePool.compute(request.toJson());
    final resMap = Map<String, dynamic>.from(rawResult);

    return TenantTaskResult(
      taskId: resMap['taskId'],
      s4ObjectPath: resMap['s4ObjectPath'],
      llmResponse: resMap['llmResponse'],
      success: resMap['success'],
      error: resMap['error'],
    );
  }

  Future<void> shutdown() async {
    await _isolatePool.stop();
  }
}
