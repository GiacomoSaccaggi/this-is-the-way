"""Beskar Vault Runner - executes inside the isolated container."""
import json
import sys

if __name__ == "__main__":
    # This is the entrypoint when no mission script is provided
    print(json.dumps({"success": False, "error": "No mission code provided"}))
