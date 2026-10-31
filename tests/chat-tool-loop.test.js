const test = require("node:test");
const assert = require("node:assert/strict");
const { generateChatReply } = require("../services/ai/chatService");

test("OpenRouter Responses API tool loop executes a tool and returns the follow-up answer", async () => {
    const requests = [];
    const client = {
        responses: {
            async create(request) {
                requests.push(request);
                if (requests.length === 1) {
                    return {
                        output: [{
                            type: "function_call",
                            name: "notApproved",
                            call_id: "call-test-1",
                            arguments: "{}"
                        }]
                    };
                }
                return {
                    output: [{ type: "message" }],
                    output_text: "I could not run that unsupported search."
                };
            }
        }
    };

    const reply = await generateChatReply("Find me a property.", { client });

    assert.equal(reply, "I could not run that unsupported search.");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].store, false);
    assert.equal(requests[0].tools.length, 2);

    const followUpInput = requests[1].input;
    const toolOutput = followUpInput.find(item =>
        item.type === "function_call_output" && item.call_id === "call-test-1"
    );
    assert.ok(toolOutput);
    assert.deepEqual(JSON.parse(toolOutput.output), {
        success: false,
        error: "Unsupported assistant tool."
    });
});

test("OpenAI tool loop rejects invalid user input before calling the provider", async () => {
    let called = false;
    const client = {
        responses: {
            async create() {
                called = true;
                return { output_text: "unexpected" };
            }
        }
    };

    await assert.rejects(
        generateChatReply("   ", { client }),
        RangeError
    );
    assert.equal(called, false);
});
