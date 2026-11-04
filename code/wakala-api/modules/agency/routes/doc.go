// Package routes answers the addresses agency.operations.json declares.
//
// There are no handlers here: the route table is data, and
// mwanachama-backend-shared/dispatch builds it by reflecting the declared
// operations onto AgencyManager. Adding an address is an edit to that file.
// Session, capability, audit and prefix policy stay with whatever mounts
// these routes, and every route carries the action a mount gates it on.
package routes
