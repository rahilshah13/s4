#ifndef S4_H
#define S4_H

#define _GNU_SOURCE
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <sys/types.h>

// --- Project Constants & Limits ---
#define S4_VERSION "1.0.0"
#define S4_DEFAULT_PORT 8080
#define S4_MAX_KEY_LEN 1024
#define S4_MAX_BUCKET_LEN 256
#define S4_MAX_TENANT_LEN 64
#define S4_MAX_NODE_ID_LEN 128

// --- Storage & Cloud-Agnostic Abstraction ---
typedef enum {
    S4_BACKEND_DISK = 0,
    S4_BACKEND_MEMORY = 1,
    S4_BACKEND_REMOTE_NODE = 2
} s4_backend_type_t;

typedef struct {
    char node_id[S4_MAX_NODE_ID_LEN];
    char storage_path[512];
    s4_backend_type_t active_backend;
    int port;
    bool debug_mode;
    char cluster_registry_endpoint[256]; 
} s4_config_t;

typedef struct {
    char tenant_id[S4_MAX_TENANT_LEN];
    char bucket[S4_MAX_BUCKET_LEN];
    char key[S4_MAX_KEY_LEN];
    size_t size;
    uint64_t last_modified;
    char etag[33];
    off_t range_start;                          // For HTTP Range requests (Nginx streaming)
    off_t range_end;                            // For HTTP Range requests (Nginx streaming)
    char assigned_node_id[S4_MAX_NODE_ID_LEN];  // For routing across arbitrarily large physical nodes
} s4_object_t;

// --- Streaming Callbacks for Large Files (Preventing OOM Behind Nginx) ---
typedef size_t (*s4_read_callback_t)(void *buffer, size_t max_size, void *user_data);
typedef size_t (*s4_write_callback_t)(const void *chunk, size_t size, void *user_data);

// --- Auth Module (`s4_auth.c`) ---
bool s4_auth_verify(const char *auth_header, const char *method, const char *uri, const char *payload_hash, const char *tenant_id);
bool s4_auth_check_acl(const char *tenant_id, const char *bucket, const char *action);

// --- Storage Module (`s4_storage.c`) ---
int s4_storage_init(s4_config_t *config);
void s4_storage_shutdown(void);

// Non-blocking, streamed storage operations
int s4_storage_put_stream(const s4_object_t *obj, s4_read_callback_t read_cb, void *user_data);
int s4_storage_get_stream(const s4_object_t *obj, s4_write_callback_t write_cb, void *user_data);
int s4_storage_delete(const s4_object_t *obj);

// Consistent hashing / topology resolution for massive physical node scaling
int s4_storage_resolve_node(const s4_object_t *obj, char *out_node_endpoint, size_t max_len);

// --- Gateway Module (`s4_gateway.c`) ---
int s4_gateway_init(s4_config_t *config);
int s4_gateway_run(void);
void s4_gateway_shutdown(void);

#endif // S4_H
