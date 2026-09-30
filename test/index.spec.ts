import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Jobhunt worker", () => {
	it("responds with health info on / (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.json()).toEqual({ name: "Jobhunt", status: "ok" });
	});

	it("responds with health info on / (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(await response.json()).toEqual({ name: "Jobhunt", status: "ok" });
	});
});
