import { describe, it, expect } from 'vitest';
import { parseJsonFromText } from './utils';

describe('parseJsonFromText', () => {
  it('should parse simple JSON', () => {
    const json = '{"key": "value"}';
    expect(parseJsonFromText(json, {})).toEqual({ key: 'value' });
  });

  it('should parse JSON inside markdown code block', () => {
    const text = 'Here is the json:\n```json\n{"key": "value"}\n```';
    expect(parseJsonFromText(text, {})).toEqual({ key: 'value' });
  });

  it('should parse JSON inside markdown code block without language', () => {
    const text = '```\n{"key": "value"}\n```';
    expect(parseJsonFromText(text, {})).toEqual({ key: 'value' });
  });

  it('should parse JSON with surrounding text', () => {
    const text = 'Some text {"key": "value"} more text';
    expect(parseJsonFromText(text, {})).toEqual({ key: 'value' });
  });

  it('should return fallback on failure', () => {
    const text = 'Invalid JSON';
    const fallback = { error: true };
    expect(parseJsonFromText(text, fallback)).toEqual(fallback);
  });

  it('should handle multiple code blocks and pick the first valid JSON', () => {
    const text = '```\nnot json\n```\n```json\n{"key": "value"}\n```';
    expect(parseJsonFromText(text, {})).toEqual({ key: 'value' });
  });
});
