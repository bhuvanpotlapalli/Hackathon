export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello to hackers in one sentence." },
      ],
    });
    return Response.json(response);
  },
};
