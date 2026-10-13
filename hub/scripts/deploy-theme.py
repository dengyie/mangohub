#!/usr/bin/env python3
"""Restricted SSH receiver for a versioned MangoHub frontend theme archive."""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import signal
import sys
import tarfile
import time
from typing import BinaryIO, Callable
import urllib.request
import uuid

DATA_ROOT = Path('/home/mango/komari/data')
MAX_COMPRESSED = 32 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024


class CheckedReader:
    def __init__(self, source: BinaryIO) -> None:
        self.source = source
        self.digest = hashlib.sha256()
        self.size = 0

    def read(self, size: int = -1) -> bytes:
        chunk = self.source.read(min(size if size >= 0 else 65536, 65536))
        self.size += len(chunk)
        if self.size > MAX_COMPRESSED:
            raise ValueError('Archive exceeds compressed size limit')
        self.digest.update(chunk)
        return chunk


def unpack(source: BinaryIO, destination: Path, checksum: str, revision: str) -> None:
    reader = CheckedReader(source)
    expanded = count = 0
    with tarfile.open(fileobj=reader, mode='r|gz') as archive:
        for member in archive:
            count += 1
            expanded += member.size
            path = PurePosixPath(member.name)
            if count > 10000 or expanded > MAX_EXPANDED:
                raise ValueError('Archive exceeds extracted size or file-count limit')
            if path.is_absolute() or '..' in path.parts or '\\' in member.name:
                raise ValueError('Invalid archive path')
            if path == PurePosixPath('.') and member.isdir():
                continue
            if not path.parts or path.parts[0] not in {'dist', 'komari-theme.json'}:
                raise ValueError('Unexpected archive entry')
            if not member.isdir() and not member.isfile():
                raise ValueError('Only regular files and directories are allowed')
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            content = archive.extractfile(member)
            if content is None:
                raise ValueError('Missing archive content')
            with content, target.open('xb') as output:
                shutil.copyfileobj(content, output, length=65536)
            target.chmod(0o644)
    while reader.read(65536):
        pass
    if reader.digest.hexdigest() != checksum:
        raise ValueError('Archive checksum mismatch')
    for name in ('dist/index.html', 'dist/frontend-release.json', 'komari-theme.json'):
        if not (destination / name).is_file():
            raise ValueError(f'Missing required file: {name}')
    metadata = json.loads((destination / 'dist/frontend-release.json').read_text())
    if metadata.get('revision') != revision:
        raise ValueError('Release revision mismatch')
    if json.loads((destination / 'komari-theme.json').read_text()).get('short') != 'komari-deer':
        raise ValueError('Incorrect theme identity')


def copy_missing(source: str, destination: str) -> str:
    if not Path(destination).exists():
        shutil.copy2(source, destination)
    return destination


def point_to(active: Path, target: Path) -> None:
    link = active.with_name(f'.komari-deer-{uuid.uuid4().hex}')
    link.symlink_to(os.path.relpath(target, active.parent), target_is_directory=True)
    os.replace(link, active)


def verify_release(revision: str) -> None:
    base = 'http://127.0.0.1:25774'
    request = urllib.request.Request(f'{base}/frontend-release.json?revision={revision}', headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=12) as response:
        metadata = json.load(response)
    if metadata.get('revision') != revision:
        raise RuntimeError('Release identity check failed on loopback')
    with urllib.request.urlopen(f'{base}/api/public', timeout=12) as response:
        public = json.load(response)
    if public.get('data', {}).get('theme') != 'komari-deer':
        raise RuntimeError('Unexpected active theme on loopback')
    with urllib.request.urlopen(f'{base}/?revision={revision}', timeout=12) as response:
        if b'/_next/static/' not in response.read(1024 * 1024):
            raise RuntimeError('Frontend HTML check failed on loopback')


def deploy(source: BinaryIO, root: Path, revision: str, checksum: str, check: Callable[[str], None]) -> Path:
    root = root.resolve()
    releases = root / 'theme-releases'
    releases.mkdir(parents=True, exist_ok=True)
    with (releases / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        candidate = releases / f'{revision}-{uuid.uuid4().hex[:8]}'
        candidate.mkdir(mode=0o755)
        unpack(source, candidate, checksum, revision)
        active = root / 'theme' / 'komari-deer'
        active.parent.mkdir(parents=True, exist_ok=True)
        previous = active.resolve() if active.exists() else None
        if previous is None:
            raise RuntimeError('Expected existing production theme; initialize manually first')
        if not previous.is_relative_to(root.resolve()):
            raise RuntimeError('Active theme must remain inside the mounted data directory')
        old_chunks = previous / 'dist/_next/static'
        if old_chunks.is_dir():
            shutil.copytree(old_chunks, candidate / 'dist/_next/static', dirs_exist_ok=True, copy_function=copy_missing)
        if not active.is_symlink():
            previous = releases / f'legacy-{time.time_ns()}'
            active.rename(previous)
        try:
            point_to(active, candidate)
            check(revision)
        except BaseException:
            point_to(active, previous)
            raise
        (releases / 'last-success.json').write_text(json.dumps({'revision': revision, 'previous': str(previous.relative_to(root)), 'active': str(candidate.relative_to(root))}) + '\n')
        return candidate


def main() -> None:
    command = shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if len(command) != 3 or command[0] != 'deploy' or not re.fullmatch('[0-9a-f]{40}', command[1]) or not re.fullmatch('[0-9a-f]{64}', command[2]):
        raise ValueError('Expected deploy <commit-sha> <archive-sha256>')
    def timeout(_signum: int, _frame: object) -> None:
        raise TimeoutError('Deployment exceeded 180 seconds')
    signal.signal(signal.SIGALRM, timeout)
    signal.signal(signal.SIGTERM, timeout)
    signal.alarm(180)
    release = deploy(sys.stdin.buffer, DATA_ROOT, command[1], command[2], verify_release)
    print(f'Deployed frontend {command[1]} to {release.name}', flush=True)


if __name__ == '__main__':
    main()
