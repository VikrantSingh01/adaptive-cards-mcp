# Adaptive Cards move collaborative work forward

*Designing agent responses that a team can act on, right inside the conversation*

---

An Adaptive Card turns an agent's answer into something a team can act on without leaving the conversation - a few key facts and an **Approve** button, right there in the channel. That one shift, from text you read to a surface you act on, is what moves an agent from answering questions to moving work forward.

It's worth being precise about why that matters. Text is still the heart of collaboration in Microsoft Teams, and agents have gotten remarkably good at the reasoning behind a good text answer - pulling the right data, drafting the right response. But when the next step is a decision or an action, a wall of text in a group chat leaves everyone reading and nobody acting. The work stalls in exactly the place it was meant to accelerate.

## What a card adds

A card layers action on top of the conversation: an expense approval with the requester, the amount, and Approve/Reject buttons. A deployment notification with a rollback action. An incident alert with acknowledge and escalate. A data summary that's actually readable on a phone. The reasoning produces the answer; the card lets the team *do something with it* - and it renders natively across Teams, Outlook, and Microsoft 365 Copilot.

And because the card lives in the channel, it's shared by default. Everyone in the conversation sees the same object, acts on the same buttons, and watches it update in place once someone responds: the approval flips to approved, the incident shows who acknowledged it. That shared, in-context state is what makes a card feel like collaborative work rather than a private exchange with a bot.

That makes the format of an agent's response part of its quality, not an afterthought. It's the design decision that's easy to skip and expensive to skip.

## Designing great cards with LLMs

Here's where it gets interesting for developers. Adaptive Cards are a rich, well-specified format, and that richness is exactly what makes them such a good target for an LLM to generate dynamically. Describe the outcome you want, and let the model assemble the layout, the inputs, and the actions to fit the moment - a different card for an approval than for a status digest, shaped by the data in front of it.

![From a natural-language description to valid, actionable Adaptive Card JSON](https://raw.githubusercontent.com/VikrantSingh01/adaptive-cards-mcp/main/media/mcp-generate.png)

The craft is making that output production-quality every time. The schema is deep, accessibility properties like `wrap`, `altText`, and `speak` are essential for screen-reader users, and different surfaces support different feature sets. Ask a model to free-hand the JSON from memory and it may invent a property or skip an accessibility attribute - the card looks plausible and renders poorly.

Designing for the surface is part of that craft, not a constraint to resent. A card headed for Outlook supports a different feature set than one in Teams, and an accessible card should be the default you reach for, not an upgrade you remember later. The more your generation step knows about where the card will land and who will read it, the better the result - which is exactly the argument for grounding the model in real specifications instead of its training-time memory.

The reliable pattern is to give the model authoritative knowledge rather than rely on recall: generate against the real schema, validate the result, and preview before you ship. The [Adaptive Cards Designer](https://adaptivecards.microsoft.com/designer) lets you prototype and validate a card visually, the published schema gives you a ground truth to check against, and the open Model Context Protocol (MCP) ecosystem is making it straightforward to hand any AI assistant that same authoritative knowledge as callable tools. A validator catches what a prompt can't.

## The takeaway

Treat your agent's response format as a first-class design decision. For every answer, ask: *could a teammate act on this without leaving the chat?* When the next step is a decision or an action, reach for an Adaptive Card, design it for the surface it will render on, and lean on your tooling - the Designer, the schema, validation - to guarantee quality rather than hoping for it.

Building an agent for Teams? Start with the [Teams developer documentation](https://learn.microsoft.com/microsoftteams/platform/) and the [Adaptive Cards Designer](https://adaptivecards.microsoft.com/designer), and design your responses as cards from day one. That's how an agent stops talking and starts moving work forward.

![adaptive-cards-mcp - 9 tools, 3 prompts, 924 tests](https://raw.githubusercontent.com/VikrantSingh01/adaptive-cards-mcp/main/media/hero.png)

**Links:**
- [npm](https://www.npmjs.com/package/adaptive-cards-mcp) - `npx adaptive-cards-mcp`
- [MCP Registry](https://registry.modelcontextprotocol.io/?q=adaptive-cards-mcp)
- [Agency Marketplace](https://vigilant-adventure-v9qpqwn.pages.github.io/playground/#plugins/adaptive-cards-mcp)
- [Adaptive Cards Designer](https://adaptivecards.microsoft.com/designer)
- [Watch the demo](https://github.com/user-attachments/assets/372655ce-776c-4e31-a77a-4b2f79f638d2)

---

*Vikrant Singh is a Principal Engineering Manager on Microsoft Teams - Conversational and AI Platform.*
