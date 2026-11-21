import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("TechWomenAZ mentorship worker", () => {
	it("serves the home page", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("TechWomen");
	});

	it("answers the health check", async () => {
		const response = await SELF.fetch("https://example.com/health");
		expect(response.status).toBe(200);
	});
});
