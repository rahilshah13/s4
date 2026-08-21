import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:isolate_manager/isolate_manager.dart';

class TenantTaskRequest {
  final String tenantId;
  final String accessKeyId;
  final String secretAccessKey;
  final String prompt;
  final String taskId;
  final String s4GatewayUrl;
  final bool isDaemon;

  TenantTaskRequest({
    required this.tenantId,
    required this.accessKeyId,
    required this.secretAccessKey,
    required this.prompt,
    required this.taskId,
    required this.s4GatewayUrl,
    required this.isDaemon,
  });

  Map<String, dynamic> toJson() => {
        'tenantId': tenantId,
        'accessKeyId': accessKeyId,
        'secretAccessKey': secretAccessKey,
        'prompt': prompt,
        'taskId': taskId,
        's4GatewayUrl': s4GatewayUrl,
        'isDaemon': isDaemon,
      };

  factory TenantTaskRequest.fromJson(Map<String, dynamic> json) => TenantTaskRequest(
        tenantId: json['tenantId'],
        accessKeyId: json['accessKeyId'],
        secretAccessKey: json['secretAccessKey'],
        prompt: json['prompt'],
        taskId: json['taskId'],
        s4GatewayUrl: json['s4GatewayUrl'],
        isDaemon: json['isDaemon'] ?? false,
      );
}

class TenantTaskResult {
  final String taskId;
  final String s4ObjectPath;
  final String llmResponse;
  final String? serverAddress;
  final bool success;
  final String? error;

  TenantTaskResult({
    required this.taskId,
    required this.s4ObjectPath,
    required this.llmResponse,
    this.serverAddress,
    required this.success,
    this.error,
  });
}

@pragma('vm:entry-point')
Future<Map<String, dynamic>> s4LambdaWorker(dynamic rawParams) async {
  final request = TenantTaskRequest.fromJson(Map<String, dynamic>.from(rawParams));

  try {
    if (request.isDaemon) {
      final server = await HttpServer.bind(InternetAddress.anyIPv4, 0);
      final port = server.port;
      final token = 'token_${DateTime.now().millisecondsSinceEpoch}_${request.taskId}';

      server.listen((HttpRequest httpRequest) async {
        final authHeader = httpRequest.headers.value('Authorization');
        if (authHeader != 'Bearer $token') {
          httpRequest.response
            ..statusCode = HttpStatus.unauthorized
            ..write('Unauthorized daemon request')
            ..close();
          return;
        }

        httpRequest.response
          ..statusCode = HttpStatus.ok
          ..write(jsonEncode({'status': 'active', 'taskId': request.taskId}))
          ..close();
      });

      final hostIp = Platform.environment['HOST_IP'] ?? '127.0.0.1';
      final endpointStr = '$hostIp:$port:$token';

      return {
        'taskId': request.taskId,
        's4ObjectPath': '',
        'llmResponse': '',
        'serverAddress': endpointStr,
        'success': true,
      };
    } else {
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
        'serverAddress': null,
        'success': true,
      };
    }
  } catch (e) {
    return {
      'taskId': request.taskId,
      's4ObjectPath': '',
      'llmResponse': '',
      'serverAddress': null,
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
  final String s4GatewayUrl;

  S4ServerlessGateway({
    this.s4GatewayUrl = 'http://localhost:8080',
  });

  Future<void> initialize() async {}

  Future<TenantTaskResult> invokeTask({
    required String tenantId,
    required String accessKeyId,
    required String secretAccessKey,
    required String prompt,
    bool isDaemon = false,
  }) async {
    final taskId = 'task_${DateTime.now().microsecondsSinceEpoch}';
    
    final request = TenantTaskRequest(
      tenantId: tenantId,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      prompt: prompt,
      taskId: taskId,
      s4GatewayUrl: s4GatewayUrl,
      isDaemon: isDaemon,
    );

    final dynamic rawResult;
    if (isDaemon) {
      final manager = IsolateManager.create(s4LambdaWorker, concurrent: 1, isDebug: false);
      await manager.start();
      rawResult = await manager.compute(request.toJson());
    } else {
      final manager = IsolateManager.create(s4LambdaWorker, concurrent: 1, isDebug: false);
      await manager.start();
      rawResult = await manager.compute(request.toJson());
      await manager.stop();
    }

    final resMap = Map<String, dynamic>.from(rawResult);

    return TenantTaskResult(
      taskId: resMap['taskId'],
      s4ObjectPath: resMap['s4ObjectPath'],
      llmResponse: resMap['llmResponse'],
      serverAddress: resMap['serverAddress'],
      success: resMap['success'],
      error: resMap['error'],
    );
  }

  Future<void> shutdown() async {}
}
