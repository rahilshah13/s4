#### s3 replacement

* `docker swarm init`
* `docker compose up --build`
* `docker stack deploy -c docker-compose.yml s4_stack`

---

## Public Endpoints

* `PUT /:bucket/:key(const char *bucket, const char *key, const char *auth_header, s4_read_callback_t read_cb, void *user_data)`
* `GET /:bucket/:key(const char *bucket, const char *key, const char *auth_header, bool has_range, off_t range_start, off_t range_end, s4_write_callback_t write_cb, void *user_data)`
* `DELETE /:bucket/:key(const char *bucket, const char *key, const char *auth_header)`
* `GET /:bucket(const char *bucket, const char *auth_header, int max_keys, const char *continuation_token, s4_write_callback_t write_cb, void *user_data)`
* `PUT /:bucket(const char *bucket, const char *auth_header)`
* `GET /tenants/:tenant_id/buckets(const char *tenant_id, const char *auth_header, s4_write_callback_t write_cb, void *user_data)`
* `GET /:bucket/events(const char *bucket, const char *auth_header, uint64_t after_event_id, s4_write_callback_t write_cb, void *user_data)`
* `GET /.well-known/acme-challenge/:token(const char *token)`
* `GET /:bucket/info/refs(const char *bucket, const char *service, const char *auth_header, s4_write_callback_t write_cb, void *user_data)`
* `POST /:bucket/git-upload-pack(const char *bucket, const char *auth_header, s4_read_callback_t read_cb, s4_write_callback_t write_cb, void *user_data)`
* `POST /:bucket/git-receive-pack(const char *bucket, const char *auth_header, s4_read_callback_t read_cb, s4_write_callback_t write_cb, void *user_data)`
* `GET /tenants/:tenant_id/prolog/kbs(const char *tenant_id, const char *auth_header, s4_write_callback_t write_cb, void *user_data)`
* `GET /tenants/:tenant_id/prolog/predicates(const char *tenant_id, const char *auth_header, s4_write_callback_t write_cb, void *user_data)`
* `POST /tenants/:tenant_id/prolog/query(const char *tenant_id, const char *query_name, const char *auth_header, s4_write_callback_t write_cb, void *user_data)`
* `GET /api/presign(const char *base_url, const char *method, const char *bucket, const char *key, uint32_t expiration_seconds, s4_write_callback_t write_cb, void *user_data)`

---

## Internal APIs (`s4.h`)

* `int s4_acme_init_db(sqlite3 *db)`
* `bool s4_acme_store_challenge(sqlite3 *db, const char *token, const char *key_auth)`
* `bool s4_acme_get_challenge(sqlite3 *db, const char *token, char *out_key_auth, size_t max_len)`
* `int s4_acme_start_background_loop(s4_config_t *config)`
* `int s4_account_create(sqlite3 *db, const char *account_id, const char *email, const char *password_hash)`
* `int s4_account_confirm(sqlite3 *db, const char *confirmation_token)`
* `int s4_email_send_confirmation(const char *email, const char *confirmation_token)`
* `int s4_bucket_share(sqlite3 *db, const char *owner_tenant_id, const char *bucket, const char *target_account_id, uint32_t permissions)`
* `bool s4_bucket_check_access(sqlite3 *db, const char *tenant_id, const char *bucket, s4_permission_t required_perm)`
* `int s4_event_init_db(sqlite3 *db)`
* `int s4_event_publish(sqlite3 *db, s4_event_type_t type, const char *tenant_id, const char *bucket, const char *key)`
* `int s4_event_poll(sqlite3 *db, const char *tenant_id, const char *bucket, uint64_t after_event_id, s4_write_callback_t write_cb, void *user_data)`
* `int s4_credential_create(sqlite3 *db, const char *account_id, char *out_access_key, char *out_secret_key)`
* `bool s4_credential_verify(sqlite3 *db, const char *access_key_id, const char *signature, const char *payload_hash, const char *string_to_sign, s4_credential_t *out_cred)`
* `int s4_presigned_url_generate(const char *base_url, const char *method, const char *bucket, const char *key, const char *access_key_id, const char *secret_access_key, uint32_t expiration_seconds, char *out_url, size_t max_url_len)`
* `bool s4_presigned_verify(sqlite3 *db, const char *method, const char *uri, const char *query_string, s4_credential_t *out_cred)`
* `int s4_db_init(s4_config_t *config)`
* `void s4_db_close(s4_config_t *config)`
* `bool s4_tenant_verify_exists(sqlite3 *db, const char *tenant_id)`
* `bool s4_bucket_create(sqlite3 *db, const char *tenant_id, const char *bucket)`
* `int s4_tenant_list_buckets(sqlite3 *db, const char *tenant_id, s4_write_callback_t write_cb, void *user_data)`
* `int s4_bucket_list_keys(sqlite3 *db, const char *tenant_id, const char *bucket, s4_write_callback_t write_cb, void *user_data)`
* `int s4_prolog_export_tenant_kb(sqlite3 *db, const char *tenant_id)`
* `int s4_prolog_export_bucket_kb(sqlite3 *db, const char *tenant_id, const char *bucket)`
* `int s4_prolog_get_knowledge_bases(sqlite3 *db, const char *tenant_id, s4_write_callback_t write_cb, void *user_data)`
* `int s4_prolog_get_predicates_human_readable(sqlite3 *db, const char *tenant_id, s4_write_callback_t write_cb, void *user_data)`
* `int s4_prolog_run_query(sqlite3 *db, const char *tenant_id, const char *query_name, s4_write_callback_t write_cb, void *user_data)`
* `int s4_wal_write_replicated(const s4_object_t *obj, s4_read_callback_t read_cb, void *user_data, s4_index_entry_t *out_idx)`
* `int s4_wal_read_replicated(const s4_object_t *obj, const s4_index_entry_t *idx, s4_write_callback_t write_cb, void *user_data)`
* `bool s4_auth_verify(sqlite3 *db, const char *auth_header, const char *method, const char *uri, const char *tenant_id)`
* `int s4_storage_init(s4_config_t *config)`
* `void s4_storage_shutdown(void)`
* `int s4_storage_put_stream(const s4_object_t *obj, s4_read_callback_t read_cb, void *user_data)`
* `int s4_storage_get_stream(const s4_object_t *obj, s4_write_callback_t write_cb, void *user_data)`
* `int s4_storage_delete(const s4_object_t *obj)`
* `int s4_git_init(s4_config_t *config)`
* `void s4_git_shutdown(void)`
* `bool s4_git_repo_init(const char *tenant_id, const char *bucket)`
* `int s4_git_handle_info_refs(const char *tenant_id, const char *bucket, const char *service, s4_write_callback_t write_cb, void *user_data)`
* `int s4_git_handle_service(const char *tenant_id, const char *bucket, const char *service, s4_read_callback_t read_cb, s4_write_callback_t write_cb, void *user_data)`
* `int s4_gateway_init(s4_config_t *config)`
* `int s4_gateway_run(void)`
* `void s4_gateway_shutdown(void)`

## Serverless Functions Gateway (`serverless_functions_gateway.dart`)

* **`S4ServerlessGateway({String s4GatewayUrl})`**
* Initializes the gateway manager instance with `s4GatewayUrl` (default `'http://localhost:8080'`).
* **`Future<void> initialize({int proxyPort})`**
* Starts the embedded reverse proxy server on the specified port (default `8081`) to route traffic to tenant serverless daemons. Must be called before handling requests.
* **`Future<TenantTaskResult> invokeTask({required String tenantId, required String accessKeyId, required String secretAccessKey, required String prompt, bool isDaemon})`**
* Dynamically spawns an isolate to execute a task or spin up a persistent serverless daemon, storing outputs to S4 or returning proxied server endpoints.
* **`Future<void> shutdown()`**
* Gracefully closes the embedded proxy server.

---

### Data Transfer Objects (DTOs)

* **`TenantTaskRequest`**
* Carries payload data from the main isolate to the background worker isolate.
* Properties: `tenantId`, `accessKeyId`, `secretAccessKey`, `prompt`, `taskId`, `s4GatewayUrl`, `isDaemon`.
* Methods: `toJson()`, `factory TenantTaskRequest.fromJson(Map<String, dynamic> json)`.
* **`TenantTaskResult`**
* Represents the structured output returned by a completed isolate task execution or daemon startup.
* Properties: `taskId` (`String`), `s4ObjectPath` (`String`), `llmResponse` (`String`), `serverAddress` (`String?`), `success` (`bool`), `error` (`String?`).
