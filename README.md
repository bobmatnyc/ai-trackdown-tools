# AI Trackdown CLI

A professional CLI tool for AI-powered project management and issue tracking.

## Installation

```bash
npm install -g ai-trackdown-tooling
```

## Usage

```bash
# Main command
aitrackdown --help

# Short alias
atd --help
```

## Quick Start

```bash
# Initialize a new project
aitrackdown init my-project

# Create an issue
aitrackdown issue create "Fix login bug" --labels bug,high-priority

# List issues
aitrackdown issue list --state open

# Check project status
aitrackdown status

# Get help
aitrackdown --help
```

## Migration from trackdown

If you were previously using the `trackdown` command, simply replace it with `aitrackdown` or use the short alias `atd`:

```bash
# Old command
trackdown issue list

# New commands (equivalent)
aitrackdown issue list
atd issue list
```

