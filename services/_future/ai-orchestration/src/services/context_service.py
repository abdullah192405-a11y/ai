"""Context service — assembles the full context for AI query processing."""

from urllib.parse import urlparse


def build_context(domain: str, page_url: str, question: str, conversation_history: list) -> dict:
    """Builds a structured context object for the AI orchestration pipeline."""
    parsed = urlparse(page_url)

    return {
        "domain": domain,
        "page_url": page_url,
        "page_path": parsed.path,
        "page_fragment": parsed.fragment,
        "question": question,
        "conversation_history": conversation_history,
        "turn_count": len(conversation_history) // 2,
    }
