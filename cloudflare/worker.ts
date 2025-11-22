export default {
    async fetch(request: Request): Promise<Response> {
      return new Response("Cloudflare Worker Active", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      })
    }
  }
  