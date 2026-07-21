<?php

require_once __DIR__ . '/../src/TrashManager.php';
require_once __DIR__ . '/../src/DuplicateFinder.php';

class CopyFallbackTrashManager extends TrashManager
{
    public int $renameAttempts = 0;

    protected function tryRename(string $from, string $to): bool
    {
        $this->renameAttempts++;
        return false;
    }
}

function assertTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function removeTree(string $path): void
{
    if (!is_dir($path)) return;
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') continue;
        $child = $path . DIRECTORY_SEPARATOR . $item;
        is_dir($child) ? removeTree($child) : unlink($child);
    }
    rmdir($path);
}

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'file_manager_trash_' . bin2hex(random_bytes(4));
$source = $root . DIRECTORY_SEPARATOR . 'source';
$trashRoot = $root . DIRECTORY_SEPARATOR . 'trash';
mkdir($source, 0777, true);

try {
    $manager = new TrashManager($trashRoot);
    $original = $source . DIRECTORY_SEPARATOR . 'duplicate.txt';
    file_put_contents($original, 'original');

    $trashed = $manager->trash($original);
    assertTrue(($trashed['status'] ?? '') === 'trashed', 'File should be moved to trash.');
    assertTrue(!file_exists($original), 'Original file should no longer exist after trashing.');
    assertTrue(file_exists($trashRoot . DIRECTORY_SEPARATOR . $trashed['id'] . DIRECTORY_SEPARATOR . 'duplicate.txt'), 'Trashed file should exist.');
    assertTrue(file_exists($trashRoot . DIRECTORY_SEPARATOR . $trashed['id'] . DIRECTORY_SEPARATOR . 'metadata.json'), 'Trash metadata should exist.');

    $restored = $manager->restore($trashed['id']);
    assertTrue(($restored['status'] ?? '') === 'restored', 'Trashed file should be restored.');
    assertTrue(file_exists($original), 'Original file should return after restore.');

    $entry = $manager->trash($original);
    file_put_contents($original, 'new file');
    $conflict = $manager->restore($entry['id']);
    assertTrue(($conflict['status'] ?? '') === 'error', 'Restore must refuse to overwrite an existing file.');
    assertTrue(file_exists($trashRoot . DIRECTORY_SEPARATOR . $entry['id'] . DIRECTORY_SEPARATOR . 'duplicate.txt'), 'Conflicting restore must retain the trashed file.');

    $expiredId = 'expired_entry';
    mkdir($trashRoot . DIRECTORY_SEPARATOR . $expiredId, 0777, true);
    file_put_contents($trashRoot . DIRECTORY_SEPARATOR . $expiredId . DIRECTORY_SEPARATOR . 'expired.txt', 'expired');
    file_put_contents($trashRoot . DIRECTORY_SEPARATOR . $expiredId . DIRECTORY_SEPARATOR . 'metadata.json', json_encode([
        'id' => $expiredId,
        'originalPath' => $source . DIRECTORY_SEPARATOR . 'expired.txt',
        'originalName' => 'expired.txt',
        'storedName' => 'expired.txt',
        'trashedAt' => date(DATE_ATOM, time() - 8 * 24 * 60 * 60),
        'expiresAt' => date(DATE_ATOM, time() - 1),
    ]));
    assertTrue($manager->purgeExpired() === 1, 'Exactly one expired entry should be purged.');
    assertTrue(!is_dir($trashRoot . DIRECTORY_SEPARATOR . $expiredId), 'Expired trash entry should be removed.');

    $cleanable = $source . DIRECTORY_SEPARATOR . 'cleanable.txt';
    file_put_contents($cleanable, 'duplicate');
    $cleaned = DuplicateFinder::clean($source, ['cleanable.txt'], $manager);
    assertTrue(($cleaned[0]['status'] ?? '') === 'trashed', 'Duplicate cleanup should move files to trash.');
    assertTrue(!file_exists($cleanable), 'Duplicate cleanup should remove the source by moving it to trash.');
    assertTrue(!empty($cleaned[0]['id']), 'Duplicate cleanup should return the trash entry ID.');

    $outside = $root . DIRECTORY_SEPARATOR . 'outside.txt';
    file_put_contents($outside, 'outside');
    $traversal = DuplicateFinder::clean($source, ['../outside.txt'], $manager);
    assertTrue(($traversal[0]['status'] ?? '') === 'error', 'Duplicate cleanup must reject paths outside the selected directory.');
    assertTrue(file_exists($outside), 'Path traversal must not move files outside the selected directory.');

    $linkPath = $source . DIRECTORY_SEPARATOR . 'dangling-link.txt';
    file_put_contents($linkPath, 'recover me');
    $linkEntry = $manager->trash($linkPath);
    if (@symlink($source . DIRECTORY_SEPARATOR . 'missing-target.txt', $linkPath)) {
        $linkConflict = $manager->restore($linkEntry['id']);
        assertTrue(($linkConflict['status'] ?? '') === 'error', 'Restore must not overwrite a dangling symbolic link.');
        assertTrue(is_link($linkPath), 'Dangling symbolic link must remain after failed restore.');
    }

    $crossVolumeTrash = __DIR__ . '/../storage/test_trash_' . bin2hex(random_bytes(4));
    $crossVolumeManager = new CopyFallbackTrashManager($crossVolumeTrash);
    $crossVolumeFile = $source . DIRECTORY_SEPARATOR . 'cross-volume.txt';
    file_put_contents($crossVolumeFile, 'cross-volume');
    $crossVolumeEntry = $crossVolumeManager->trash($crossVolumeFile);
    assertTrue(($crossVolumeEntry['status'] ?? '') === 'trashed', 'Trash should work when its storage is on another available volume.');
    assertTrue(($crossVolumeManager->restore($crossVolumeEntry['id'])['status'] ?? '') === 'restored', 'Restore should work when its storage is on another available volume.');
    assertTrue($crossVolumeManager->renameAttempts >= 2, 'Trash and restore should exercise the copy/unlink fallback when rename is unavailable.');
    removeTree($crossVolumeTrash);

    echo "PASS: Trash entries remain recoverable for seven days.\n";
} finally {
    removeTree($root);
}
