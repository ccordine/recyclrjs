package examples

import (
	"log"
	"net/http"
	"text/template"
)

var htmlTemplate = template.Must(template.ParseFiles("index.html"))

func UsersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	if err := htmlTemplate.Execute(w, nil); err != nil {
		log.Fatal(err)
	}
}
