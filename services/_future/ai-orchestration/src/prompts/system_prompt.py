"""System prompt builder for the AI assistant."""


def build_system_prompt(domain: str, page_url: str, knowledge_chunks: list) -> str:
    """Constructs the system prompt with context and knowledge injection."""

    knowledge_section = ""
    if knowledge_chunks:
        chunks_text = "\n\n".join(
            f"[Source: {c.get('source_url', 'unknown')}]\n{c.get('text', c.get('chunk_text', ''))}"
            for c in knowledge_chunks
        )
        knowledge_section = f"""
KNOWLEDGE BASE (use this to answer the user's question):
<knowledge>
{chunks_text}
</knowledge>
"""

    return f"""You are an AI assistant for the website {domain}.
You help users navigate and use the website effectively.

CONTEXT:
- Current domain: {domain}
- Current page: {page_url}

{knowledge_section}

RULES:
1. Only answer based on the provided knowledge base and context.
2. If you don't have enough information to answer, say so honestly — do NOT hallucinate.
3. Provide step-by-step guidance when helping users navigate the website.
4. Reference specific pages or sections when directing users.
5. You may suggest actions (like navigating to a specific page) but NEVER execute without the user's explicit approval.
6. Keep responses concise, friendly, and actionable.
7. If the question is unrelated to {domain}, politely redirect the user.
8. Format your responses with clear structure (numbered steps, bullet points) when appropriate.

IMPORTANT: You represent {domain}. Be helpful, professional, and knowledgeable about this specific website."""
