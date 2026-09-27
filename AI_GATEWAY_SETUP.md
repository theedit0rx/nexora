# AI gateway connection

NEXORA's Sales intent classifier now uses the workspace's selected AI provider.
Replies remain deterministic drafts; this integration does not send messages.
Other agents still need AI integration. Classification records include the provider,
model, fallback status and token usage in task output. Costs are estimates.

## Recommended production option: LiteLLM

LiteLLM provides an OpenAI-compatible gateway, routing, provider failover and
per-key budgets. Deploy and secure it separately using its official documentation:
https://docs.litellm.ai/docs/simple_proxy

Configure these server environment variables:

```dotenv
AI_GATEWAY_BASE_URL=https://your-gateway.example/v1
AI_GATEWAY_API_KEY=your-scoped-gateway-key
AI_GATEWAY_MODEL=your-configured-model-alias
```

In NEXORA Settings, choose `gateway`. Set Model to your gateway alias, or leave
the default `local-deterministic` value to use AI_GATEWAY_MODEL. Set provider budgets
at the gateway before using real prospect messages. Keys belong on the server only.
Use a gateway endpoint you control and HTTPS for remote connections.

## Experimental option: FreeLLMAPI

Reference: https://github.com/tashfeenahmed/freellmapi
The Instagram reference was https://www.instagram.com/p/DdbkqpEH9t8/ .
Its advertised capacity aggregates upstream free tiers; it is not a guaranteed
allocation for a user. Its maintainers describe it as personal experimentation,
not production. You still supply upstream provider keys and follow their terms.
Its compatible endpoint can use the same NEXORA gateway settings for local experiments.

## Failure behavior

Requests have a 20-second timeout and reject redirects. Responses must match the
intent schema. Explicit opt-outs use deterministic rules without contacting AI.
The workspace fallback switch determines whether remote failures fall back to
rules or fail the task. Missing credentials are reported as not configured.

No gateway service or provider account was deployed by this change. Tests use
mock HTTP responses; live inference still requires your endpoint and credentials.
