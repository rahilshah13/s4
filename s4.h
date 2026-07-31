#ifndef S4_H
#define S4_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <sys/types.h>
#include <sqlite3.h>

#define S4_VERSION "1.2.0"
#define S4_DEFAULT_PORT 8080
#define S4_MAX_KEY_LEN 1024
#define S4_MAX_BUCKET_LEN 256
#define S4_MAX_TENANT_LEN 64
#define S4_MAX_NODE_ID_LEN 128
#define S4_ACME_TOKEN_LEN 256
#define S4_MAX_EMAIL_LEN 256
#define S4_ACCESS_KEY_LEN 64
#define S4_SECRET_KEY_LEN 128

typedef enum {
    S4_BACKEND_DISK = 0,
    S4_BACKEND_MEMORY = 1,
    S4_BACKEND_REMOTE_NODE = 2,
    S4_BACKEND_GIT = 3
} s4_backend_type_t;

typedef enum {
    S4_PERM_READ = 1 << 0,
    S4_PERM_WRITE = 1 << 1,
    S4_PERM_LIST = 1 << 2,
    S4_PERM_GIT = 1 << 3
} s4_permission_t;

typedef enum {
    S4_EVENT_OBJECT_CREATED = 1 << 0,
    S4_EVENT_OBJECT_DELETED = 1 << 1,
    S4_EVENT_BUCKET_CREATED = 1 << 2,
    S4_EVENT_GIT_PUSH = 1 << 3
} s4_event_type_t;

typedef struct {
    uint64_t event_id;
    s4_event_type_t type;
    char tenant_id[S4_MAX_TENANT_LEN];
    char bucket[S4_MAX_BUCKET_LEN];
    char key[S4_MAX_KEY_LEN];
    uint64_t timestamp;
} s4_event_t;

typedef struct {
    char node_id[S4_MAX_NODE_ID_LEN];
    char storage_path[512];
    char db_path[512];
    char certs_path[512];
    char domain[256];
    char contact_email[S4_MAX_EMAIL_LEN];
    s4_backend_type_t active_backend;
    int port;
    bool debug_mode;
    sqlite3 *db_handle;
} s4_config_t;

typedef struct {
    char tenant_id[S4_MAX_TENANT_LEN];
    char owner_tenant_id[S4_MAX_TENANT_LEN];
    char bucket[S4_MAX_BUCKET_LEN];
    char key[S4_MAX_KEY_LEN];
    size_t size;
    uint64_t last_modified;
    char etag[33];
    bool has_range;
    off_t range_start;
    off_t range_end;
    char assigned_node_id[S4_MAX_NODE_ID_LEN];
} s4_object_t;

typedef struct {
    char account_id[S4_MAX_TENANT_LEN];
    char email[S4_MAX_EMAIL_LEN];
    bool is_confirmed;
} s4_account_t;

typedef struct {
    char access_key_id[S4_ACCESS_KEY_LEN];
    char secret_access_key[S4_SECRET_KEY_LEN];
    char account_id[S4_MAX_TENANT_LEN];
    bool is_active;
} s4_credential_t;

// --- Streaming Callbacks for Large Files ---
typedef size_t (*s4_read_callback_t)(void *buffer, size_t max_size, void *user_data);
typedef size_t (*s4_write_callback_t)(const void *chunk, size_t size, void *user_data);

// --- Native ACME Challenge Module ---
int s4_acme_init_db(sqlite3 *db);
bool s4_acme_store_challenge(sqlite3 *db, const char *token, const char *key_auth);
bool s4_acme_get_challenge(sqlite3 *db, const char *token, char *out_key_auth, size_t max_len);
int s4_acme_start_background_loop(s4_config_t *config);

// --- Account Management, Confirmation, & Sharing Flows ---
int s4_account_create(sqlite3 *db, const char *account_id, const char *email, const char *password_hash);
int s4_account_confirm(sqlite3 *db, const char *confirmation_token);
int s4_email_send_confirmation(const char *email, const char *confirmation_token);
int s4_bucket_share(sqlite3 *db, const char *owner_tenant_id, const char *bucket, const char *target_account_id, uint32_t permissions);
bool s4_bucket_check_access(sqlite3 *db, const char *tenant_id, const char *bucket, s4_permission_t required_perm);

// --- Event Streams & Bucket Notifications Module ---
int s4_event_init_db(sqlite3 *db);
int s4_event_publish(sqlite3 *db, s4_event_type_t type, const char *tenant_id, const char *bucket, const char *key);
int s4_event_poll(sqlite3 *db, const char *tenant_id, const char *bucket, uint64_t after_event_id, s4_write_callback_t write_cb, void *user_data);

// --- Programmatic Credential Management ---
int s4_credential_create(sqlite3 *db, const char *account_id, char *out_access_key, char *out_secret_key);
bool s4_credential_verify(sqlite3 *db, const char *access_key_id, const char *signature, const char *payload_hash, const char *string_to_sign, s4_credential_t *out_cred);

// --- Multitenancy & RDBMS Metadata Module ---
int s4_db_init(s4_config_t *config);
void s4_db_close(s4_config_t *config);
bool s4_tenant_verify_exists(sqlite3 *db, const char *tenant_id);
bool s4_bucket_create(sqlite3 *db, const char *tenant_id, const char *bucket);
int s4_tenant_list_buckets(sqlite3 *db, const char *tenant_id, s4_write_callback_t write_cb, void *user_data);
int s4_bucket_list_keys(sqlite3 *db, const char *tenant_id, const char *bucket, s4_write_callback_t write_cb, void *user_data);

// --- Auth Module (`s4_auth.c`) ---
bool s4_auth_verify(sqlite3 *db, const char *auth_header, const char *method, const char *uri, const char *tenant_id);
bool s4_auth_check_acl(sqlite3 *db, const char *tenant_id, const char *bucket, const char *action);

// --- Storage Module (`s4_storage.c`) ---
int s4_storage_init(s4_config_t *config);
void s4_storage_shutdown(void);
int s4_storage_put_stream(const s4_object_t *obj, s4_read_callback_t read_cb, void *user_data);
int s4_storage_get_stream(const s4_object_t *obj, s4_write_callback_t write_cb, void *user_data);
int s4_storage_delete(const s4_object_t *obj);

// --- Git Server & Repository Module (`s4_git.c`) ---
int s4_git_init(s4_config_t *config);
void s4_git_shutdown(void);
bool s4_git_repo_init(const char *tenant_id, const char *bucket);
int s4_git_handle_info_refs(const char *tenant_id, const char *bucket, const char *service, s4_write_callback_t write_cb, void *user_data);
int s4_git_handle_service(const char *tenant_id, const char *bucket, const char *service, s4_read_callback_t read_cb, s4_write_callback_t write_cb, void *user_data);

// --- Gateway Module (`s4_gateway.c`) ---
int s4_gateway_init(s4_config_t *config);
int s4_gateway_run(void);
void s4_gateway_shutdown(void);

#endif // S4_H
