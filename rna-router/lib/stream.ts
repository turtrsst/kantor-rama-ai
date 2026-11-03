export function createSSEResponse(fullText: string) {
  const encoder = new TextEncoder();
  const lines = fullText.split(/(?<=[.!?])\s+/); // split by sentence-ish
  let index = 0;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: {\"id\":\"stream-" + Date.now() + "\",\"object\":\"chat.completion.chunk\",\"created\":" + Math.floor(Date.now() / 1000) + ",\"model\":\"rna-stream\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"},\"finish_reason\":null}]}\n\n"));

      const interval = setInterval(() => {
        if (index >= lines.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          clearInterval(interval);
          return;
        }
        const chunk = lines[index];
        index++;
        const payload = JSON.stringify({
          id: "stream-" + Date.now(),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "rna-stream",
          choices: [{ index: 0, delta: { content: chunk + " " }, finish_reason: null }],
        });
        controller.enqueue(encoder.encode("data: " + payload + "\n\n"));
      }, 80);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
