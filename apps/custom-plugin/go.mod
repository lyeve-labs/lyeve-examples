module github.com/lyeve-labs/lyeve-examples/custom-plugin

go 1.27.1

require (
	github.com/go-chi/chi/v5 v5.3.2
	github.com/google/uuid v1.6.0
	github.com/lyeve-labs/lyeve-core v0.24.0
)

require (
	filippo.io/edwards25519 v1.2.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/go-sql-driver/mysql v1.10.1 // indirect
	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.10.0 // indirect
	github.com/microsoft/go-mssqldb v1.11.0 // indirect
	github.com/prometheus/client_model v0.6.3 // indirect
	github.com/shopspring/decimal v1.4.0 // indirect
	go.opentelemetry.io/otel v1.46.0 // indirect
	go.opentelemetry.io/otel/trace v1.46.0 // indirect
	golang.org/x/crypto v0.56.0 // indirect
	golang.org/x/text v0.41.0 // indirect
	google.golang.org/protobuf v1.36.12 // indirect
)

// The engine builds from a lyeve-core checkout beside this repository. To use
// a checkout somewhere else, run
// go mod edit -replace github.com/lyeve-labs/lyeve-core=<path>.
replace github.com/lyeve-labs/lyeve-core => ../../../lyeve-core
