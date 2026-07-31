#### s3 replacement

* `docker swarm init`
* `docker build -t s4:latest .`
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
* `int s4_db_init(s4_config_t *config)`
* `void s4_db_close(s4_config_t *config)`
* `bool s4_tenant_verify_exists(sqlite3 *db, const char *tenant_id)`
* `bool s4_bucket_create(sqlite3 *db, const char *tenant_id, const char *bucket)`
* `int s4_tenant_list_buckets(sqlite3 *db, const char *tenant_id, s4_write_callback_t write_cb, void *user_data)`
* `int s4_bucket_list_keys(sqlite3 *db, const char *tenant_id, const char *bucket, s4_write_callback_t write_cb, void *user_data)`
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
