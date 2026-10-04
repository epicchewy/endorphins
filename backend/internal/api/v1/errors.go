package v1

import (
	"encoding/json"
	"net/http"
)

type ErrorResponse struct {
	Message   string `json:"message"`
	Code      string `json:"code"`
	RequestID string `json:"requestId"`
}

// WriteError is shared with non-Echo integrations so every API failure has the same envelope.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	// The response is already committed; a disconnected client is handled by net/http.
	_ = json.NewEncoder(w).Encode(ErrorResponse{Message: message, Code: code, RequestID: w.Header().Get("X-Request-ID")})
}
