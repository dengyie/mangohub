import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('deploy_theme', Path(__file__).parents[1] / 'scripts/deploy-theme.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
REVISION = 'a' * 40


def bundle(extra=None):
    data = io.BytesIO()
    files = {'dist/index.html': '<script src="/_next/static/new.js"></script>', 'dist/_next/static/new.js': 'new', 'dist/frontend-release.json': json.dumps({'revision': REVISION}), 'komari-theme.json': '{"short":"komari-deer"}'}
    with tarfile.open(fileobj=data, mode='w:gz') as archive:
        for name, value in files.items():
            encoded = value.encode()
            member = tarfile.TarInfo(name)
            member.size = len(encoded)
            archive.addfile(member, io.BytesIO(encoded))
        if extra:
            archive.addfile(extra, io.BytesIO(b'x') if extra.isfile() else None)
    raw = data.getvalue()
    return raw, hashlib.sha256(raw).hexdigest()


class DeployThemeTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='mangohub-deploy-test-'))
        self.active = self.root / 'theme/komari-deer'
        (self.active / 'dist/_next/static').mkdir(parents=True)
        (self.active / 'dist/index.html').write_text('previous')
        (self.active / 'dist/_next/static/old.js').write_text('old')

    def test_switch_is_relative_and_retains_old_chunks(self):
        raw, digest = bundle()
        seen = []
        release = module.deploy(io.BytesIO(raw), self.root, REVISION, digest, lambda revision: seen.append(revision))
        self.assertEqual(seen, [REVISION])
        self.assertTrue(self.active.is_symlink())
        self.assertEqual(self.active.resolve(), release)
        self.assertEqual((release / 'dist/_next/static/old.js').read_text(), 'old')
        self.assertEqual((release / 'dist/_next/static/new.js').read_text(), 'new')
        self.assertFalse(self.active.readlink().is_absolute())
        state = json.loads((self.root / 'theme-releases/last-success.json').read_text())
        self.assertEqual((self.root / state['previous'] / 'dist/index.html').read_text(), 'previous')

    def test_failed_healthcheck_rolls_back(self):
        raw, digest = bundle()
        def fail(_revision):
            self.assertNotEqual((self.active / 'dist/index.html').read_text(), 'previous')
            raise RuntimeError('Injected health failure')
        with self.assertRaisesRegex(RuntimeError, 'Injected'):
            module.deploy(io.BytesIO(raw), self.root, REVISION, digest, fail)
        self.assertEqual((self.active / 'dist/index.html').read_text(), 'previous')

    def test_checksum_failure_never_switches(self):
        raw, _digest = bundle()
        with self.assertRaisesRegex(ValueError, 'checksum'):
            module.deploy(io.BytesIO(raw), self.root, REVISION, '0' * 64, lambda _: self.fail())
        self.assertFalse(self.active.is_symlink())
        self.assertEqual((self.active / 'dist/index.html').read_text(), 'previous')

    def test_traversal_symlink_and_unexpected_entries_are_rejected(self):
        for name, kind in [('dist/../../escape', tarfile.REGTYPE), ('/tmp/escape', tarfile.REGTYPE), ('dist/escape', tarfile.SYMTYPE), ('secret', tarfile.REGTYPE)]:
            with self.subTest(name=name):
                entry = tarfile.TarInfo(name)
                entry.type = kind
                entry.linkname = '/etc'
                entry.size = 1 if kind == tarfile.REGTYPE else 0
                raw, digest = bundle(entry)
                with self.assertRaises(ValueError):
                    module.deploy(io.BytesIO(raw), self.root, REVISION, digest, lambda _: self.fail())
                self.assertEqual((self.active / 'dist/index.html').read_text(), 'previous')

    def test_revision_mismatch_never_switches(self):
        raw, digest = bundle()
        with self.assertRaisesRegex(ValueError, 'revision'):
            module.deploy(io.BytesIO(raw), self.root, 'b' * 40, digest, lambda _: self.fail())
        self.assertEqual((self.active / 'dist/index.html').read_text(), 'previous')

    def test_second_deployment_can_roll_back_to_first_symlink(self):
        raw, digest = bundle()
        previous = module.deploy(io.BytesIO(raw), self.root, REVISION, digest, lambda _: None)
        def fail(_revision):
            raise RuntimeError('Rollback')
        with self.assertRaises(RuntimeError):
            module.deploy(io.BytesIO(raw), self.root, REVISION, digest, fail)
        self.assertEqual(self.active.resolve(), previous)

    def test_release_healthcheck_uses_loopback_only(self):
        responses = []
        for body in (
            json.dumps({'revision': REVISION}).encode(),
            json.dumps({'data': {'theme': 'komari-deer'}}).encode(),
            b'<script src="/_next/static/app.js"></script>',
        ):
            response = MagicMock()
            response.__enter__.return_value = response
            response.read.return_value = body
            responses.append(response)
        with patch.object(module.urllib.request, 'urlopen', side_effect=responses) as urlopen:
            module.verify_release(REVISION)
        urls = [getattr(call.args[0], 'full_url', call.args[0]) for call in urlopen.call_args_list]
        self.assertEqual(len(urls), 3)
        self.assertTrue(all(url.startswith('http://127.0.0.1:25774/') for url in urls))


if __name__ == '__main__':
    unittest.main()
