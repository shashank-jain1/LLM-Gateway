"""
Anthropic Messages API compatibility layer.

Translates between Anthropic Messages format and OpenAI Chat Completions format.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator, Dict, List


def translate_request(anthropic_body: Dict[str, Any]) -> Dict[str, Any]:
    """Translate Anthropic Messages request body to OpenAI Chat Completions format."""
    openai_body: Dict[str, Any] = {}

    # Basic fields
    openai_body["model"] = anthropic_body.get("model")
    if "max_tokens" in anthropic_body:
        openai_body["max_tokens"] = anthropic_body["max_tokens"]
    if "temperature" in anthropic_body:
        openai_body["temperature"] = anthropic_body["temperature"]
    if "top_p" in anthropic_body:
        openai_body["top_p"] = anthropic_body["top_p"]
    if "stream" in anthropic_body:
        openai_body["stream"] = anthropic_body["stream"]

    # Convert tools
    if "tools" in anthropic_body:
        openai_tools = []
        for tool in anthropic_body["tools"]:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name"),
                    "description": tool.get("description"),
                    "parameters": tool.get("input_schema", {}),
                }
            })
        openai_body["tools"] = openai_tools

    # Messages array compilation
    openai_messages: List[Dict[str, Any]] = []

    # Map top-level system prompt to OpenAI role: system
    system = anthropic_body.get("system")
    if system:
        if isinstance(system, list):
            system_text = "".join(block.get("text", "") for block in system if block.get("type") == "text")
        else:
            system_text = str(system)
        if system_text:
            openai_messages.append({"role": "system", "content": system_text})

    # Process individual messages
    anthropic_messages = anthropic_body.get("messages", [])
    for msg in anthropic_messages:
        role = msg.get("role")
        content = msg.get("content")

        if isinstance(content, list):
            # Check for tool_result block (sent by user)
            is_tool_result = any(block.get("type") == "tool_result" for block in content)

            if is_tool_result and role == "user":
                for block in content:
                    if block.get("type") == "tool_result":
                        openai_messages.append({
                            "role": "tool",
                            "tool_call_id": block.get("tool_use_id"),
                            "content": str(block.get("content", "")),
                        })
                    elif block.get("type") == "text":
                        openai_messages.append({
                            "role": "user",
                            "content": block.get("text", ""),
                        })
                continue

            # Check for tool_use block (sent by assistant)
            has_tool_use = any(block.get("type") == "tool_use" for block in content)

            if has_tool_use and role == "assistant":
                text_content = ""
                tool_calls = []
                for block in content:
                    if block.get("type") == "text":
                        text_content += block.get("text", "")
                    elif block.get("type") == "tool_use":
                        tool_calls.append({
                            "id": block.get("id"),
                            "type": "function",
                            "function": {
                                "name": block.get("name"),
                                "arguments": json.dumps(block.get("input", {})),
                            }
                        })
                openai_messages.append({
                    "role": "assistant",
                    "content": text_content if text_content else None,
                    "tool_calls": tool_calls,
                })
                continue

            # Process standard user content block lists (text or image)
            openai_blocks = []
            for block in content:
                b_type = block.get("type")
                if b_type == "text":
                    openai_blocks.append({
                        "type": "text",
                        "text": block.get("text", ""),
                    })
                elif b_type == "image":
                    source = block.get("source", {})
                    media_type = source.get("media_type")
                    data = source.get("data")
                    if media_type and data:
                        openai_blocks.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{data}"
                            }
                        })

            # Check if block list only contains text blocks
            if all(b["type"] == "text" for b in openai_blocks):
                openai_messages.append({
                    "role": role,
                    "content": "".join(b["text"] for b in openai_blocks),
                })
            else:
                openai_messages.append({
                    "role": role,
                    "content": openai_blocks,
                })
        else:
            # Content is a simple string
            openai_messages.append({
                "role": role,
                "content": str(content),
            })

    openai_body["messages"] = openai_messages
    return openai_body


def translate_response(openai_resp: Dict[str, Any]) -> Dict[str, Any]:
    """Translate OpenAI Chat Completions response to Anthropic Messages response format."""
    anthropic_resp: Dict[str, Any] = {}

    # Map ID
    openai_id = openai_resp.get("id", "")
    if openai_id.startswith("chatcmpl-"):
        anthropic_resp["id"] = f"msg_{openai_id[9:]}"
    else:
        anthropic_resp["id"] = openai_id if openai_id else f"msg_{uuid.uuid4().hex[:20]}"

    anthropic_resp["type"] = "message"
    anthropic_resp["role"] = "assistant"
    anthropic_resp["model"] = openai_resp.get("model", "unknown")

    content: List[Dict[str, Any]] = []
    stop_reason = "end_turn"

    if "choices" in openai_resp and len(openai_resp["choices"]) > 0:
        choice = openai_resp["choices"][0]
        message = choice.get("message", {})

        # Extract text content
        text = message.get("content")
        if text:
            content.append({
                "type": "text",
                "text": text,
            })

        # Extract tool calls
        tool_calls = message.get("tool_calls", [])
        if tool_calls:
            stop_reason = "tool_use"
            for tc in tool_calls:
                args_str = tc.get("function", {}).get("arguments", "{}")
                try:
                    args = json.loads(args_str)
                except Exception:
                    args = {}
                content.append({
                    "type": "tool_use",
                    "id": tc.get("id"),
                    "name": tc.get("function", {}).get("name"),
                    "input": args,
                })

        # Translate finish reason
        openai_finish = choice.get("finish_reason")
        if openai_finish == "stop":
            stop_reason = "end_turn"
        elif openai_finish == "tool_calls":
            stop_reason = "tool_use"
        elif openai_finish == "length":
            stop_reason = "max_tokens"

    anthropic_resp["content"] = content
    anthropic_resp["stop_reason"] = stop_reason
    anthropic_resp["stop_sequence"] = None

    # Map usage
    usage = openai_resp.get("usage", {})
    anthropic_resp["usage"] = {
        "input_tokens": usage.get("prompt_tokens", 0),
        "output_tokens": usage.get("completion_tokens", 0),
    }

    return anthropic_resp


async def translate_stream(openai_stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    """Translate raw OpenAI SSE bytes stream to Anthropic Messages SSE events stream."""
    msg_id = f"msg_{uuid.uuid4().hex[:20]}"
    sent_start = False
    content_block_started = False
    open_tool_calls = {}  # index -> {"id": tc_id, "name": tc_name, "anthropic_index": int}
    model_name = "unknown"
    buffer = ""

    async for chunk in openai_stream:
        buffer += chunk.decode(errors="replace")

        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()

            if not line:
                continue
            if not line.startswith("data:"):
                continue

            data_str = line[5:].strip()
            if data_str == "[DONE]":
                break

            try:
                data = json.loads(data_str)
            except Exception:
                continue

            if "model" in data:
                model_name = data["model"]

            choices = data.get("choices", [])
            if not choices:
                continue

            choice = choices[0]
            delta = choice.get("delta", {})

            # 1. Send message_start on the first chunk
            if not sent_start:
                sent_start = True
                msg_start_event = {
                    "type": "message_start",
                    "message": {
                        "id": msg_id,
                        "type": "message",
                        "role": "assistant",
                        "model": model_name,
                        "content": [],
                        "stop_reason": None,
                        "stop_sequence": None,
                        "usage": {"input_tokens": 0, "output_tokens": 0},
                    }
                }
                yield f"event: message_start\ndata: {json.dumps(msg_start_event)}\n\n".encode("utf-8")

            # 2. Extract content delta
            content = delta.get("content")
            if content:
                # Start content block if not started
                if not content_block_started:
                    content_block_started = True
                    block_start_event = {
                        "type": "content_block_start",
                        "index": 0,
                        "content_block": {"type": "text", "text": ""},
                    }
                    yield f"event: content_block_start\ndata: {json.dumps(block_start_event)}\n\n".encode("utf-8")

                # Emit content block delta
                delta_event = {
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {"type": "text_delta", "text": content},
                }
                yield f"event: content_block_delta\ndata: {json.dumps(delta_event)}\n\n".encode("utf-8")

            # Extract tool calls from delta
            tool_calls = delta.get("tool_calls", [])
            for tc in tool_calls:
                tc_idx = tc.get("index")
                if tc_idx is None:
                    continue

                tc_id = tc.get("id")
                function = tc.get("function", {})
                tc_name = function.get("name")
                tc_args = function.get("arguments")

                # Map to Anthropic index. If we started index 0 as text, start tool calls from index 1.
                anthropic_idx = tc_idx + 1

                # If this is the start of a tool call
                if tc_id and tc_name:
                    open_tool_calls[tc_idx] = {
                        "id": tc_id,
                        "name": tc_name,
                        "anthropic_index": anthropic_idx
                    }
                    block_start_event = {
                        "type": "content_block_start",
                        "index": anthropic_idx,
                        "content_block": {
                            "type": "tool_use",
                            "id": tc_id,
                            "name": tc_name,
                            "input": {}
                        }
                    }
                    yield f"event: content_block_start\ndata: {json.dumps(block_start_event)}\n\n".encode("utf-8")

                # If we have arguments partial json delta
                if tc_args:
                    block_delta_event = {
                        "type": "content_block_delta",
                        "index": anthropic_idx,
                        "delta": {
                            "type": "input_json_delta",
                            "partial_json": tc_args
                        }
                    }
                    yield f"event: content_block_delta\ndata: {json.dumps(block_delta_event)}\n\n".encode("utf-8")

            # 3. Check for finish reason / end of block
            finish_reason = choice.get("finish_reason")
            if finish_reason:
                if content_block_started:
                    block_stop_event = {
                        "type": "content_block_stop",
                        "index": 0,
                    }
                    yield f"event: content_block_stop\ndata: {json.dumps(block_stop_event)}\n\n".encode("utf-8")
                    content_block_started = False

                for tc_idx, tc_state in list(open_tool_calls.items()):
                    block_stop_event = {
                        "type": "content_block_stop",
                        "index": tc_state["anthropic_index"],
                    }
                    yield f"event: content_block_stop\ndata: {json.dumps(block_stop_event)}\n\n".encode("utf-8")
                open_tool_calls.clear()

                stop_reason = "end_turn"
                if finish_reason == "stop":
                    stop_reason = "end_turn"
                elif finish_reason == "tool_calls":
                    stop_reason = "tool_use"
                elif finish_reason == "length":
                    stop_reason = "max_tokens"

                msg_delta_event = {
                    "type": "message_delta",
                    "delta": {"stop_reason": stop_reason, "stop_sequence": None},
                    "usage": {"output_tokens": 0},
                }
                yield f"event: message_delta\ndata: {json.dumps(msg_delta_event)}\n\n".encode("utf-8")

    # If stream ended abruptly, ensure we close open blocks
    if content_block_started:
        block_stop_event = {
            "type": "content_block_stop",
            "index": 0,
        }
        yield f"event: content_block_stop\ndata: {json.dumps(block_stop_event)}\n\n".encode("utf-8")

    for tc_idx, tc_state in list(open_tool_calls.items()):
        block_stop_event = {
            "type": "content_block_stop",
            "index": tc_state["anthropic_index"],
        }
        yield f"event: content_block_stop\ndata: {json.dumps(block_stop_event)}\n\n".encode("utf-8")

    # 4. Final message_stop event
    msg_stop_event = {
        "type": "message_stop",
    }
    yield f"event: message_stop\ndata: {json.dumps(msg_stop_event)}\n\n".encode("utf-8")
