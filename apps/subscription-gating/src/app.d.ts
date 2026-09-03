declare global {
	namespace App {
		interface Locals {
			/** Set by hooks.server.ts from the signed cookie. Null when signed out. */
			readerId: string | null;
		}
	}
}

export {};
