package routes

import (
	"fmt"
	"net/http"
)

// IndexHandler is the handler for the root URL ("/")
func IndexHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Welcome to my web server!")
}
