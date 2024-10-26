package main

import (
	"fmt"
	// "log"
	"net/http"
	// "github.com/ccordine/recyclrjs/routes"
)

func main() {
	fmt.Println("Starting server...")
	http.Handle("/", http.FileServer(http.Dir("./static")))
	// http.HandleFunc("/", routes.IndexHandler)
	fmt.Println("Listening to :8000...")
	http.ListenAndServe(":8000", nil)
	// log.Fatal(http.ListenAndServe(":8000", nil))
	// fmt.Println("Hosting on :8000...")
}
