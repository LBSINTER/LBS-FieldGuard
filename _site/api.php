<?php
/**
 * FieldGuard PC Bridge relay + Secure Comms relay
 * SQLite store under ../_data/ (writable by PHP-FPM).
 *
 * PC Bridge: action=X query-param routes
 * Secure Comms: PATH_INFO /comms/* REST routes
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-FG-Token, X-FG-SHA256, X-FG-Filename, X-FG-Viewer-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawIn  = file_get_contents('php://input') ?: '';
$jsonIn = $rawIn !== '' ? json_decode($rawIn, true) : null;
if (!is_array($jsonIn)) {
    $jsonIn = [];
}

$dataDir = dirname(__DIR__) . '/_data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'data directory unavailable']);
    exit;
}

$dbPath = $dataDir . '/fg-relay.sqlite';
$pdo = new PDO('sqlite:' . $dbPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

// ── PC Bridge tables ──────────────────────────────────────────────────────
$pdo->exec('CREATE TABLE IF NOT EXISTS fg_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_token TEXT NOT NULL UNIQUE,
  viewer_token TEXT,
  pin TEXT NOT NULL,
  session_id TEXT NOT NULL,
  pc_connected INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  device_id TEXT,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS fg_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_token TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS fg_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_token TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  body TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)');

// ── Comms core tables ─────────────────────────────────────────────────────
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_user (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_lbs_member INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_token (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_key (
  user_id TEXT NOT NULL PRIMARY KEY,
  public_key_armored TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_group (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT "",
  group_type TEXT NOT NULL DEFAULT "public",
  created_by TEXT,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_membership (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT "member",
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_message (
  msg_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_read_pos (
  user_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, group_id)
)');
$pdo->exec('CREATE INDEX IF NOT EXISTS idx_comms_msg_grp ON comms_message (group_id, created_at)');

// ── DM tables ─────────────────────────────────────────────────────────────
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_dm (
  dm_id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_dm_message (
  msg_id TEXT PRIMARY KEY,
  dm_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE IF NOT EXISTS comms_dm_read_pos (
  user_id TEXT NOT NULL,
  dm_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, dm_id)
)');
$pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_comms_dm_pair ON comms_dm (min(user_a,user_b), max(user_a,user_b))');
$pdo->exec('CREATE INDEX IF NOT EXISTS idx_comms_dm_msg ON comms_dm_message (dm_id, created_at)');

// ── Seed default groups once ──────────────────────────────────────────────
if ((int)$pdo->query('SELECT COUNT(*) FROM comms_group')->fetchColumn() === 0) {
    $now  = time();
    $seeds = [
        ['ops-north',  'OPS-NORTH',  'Field operations — Northern Region',     'lbs-internal'],
        ['intel',      'INTEL',      'Intelligence & analysis channel',          'lbs-internal'],
        ['general',    'GENERAL',    'LBS INT internal communications',          'lbs-internal'],
        ['tech',       'TECH',       'Technology & infrastructure team',         'lbs-internal'],
        ['community',  'COMMUNITY',  'Open channel for all FieldGuard users',    'public'],
    ];
    $ins = $pdo->prepare('INSERT OR IGNORE INTO comms_group (group_id, name, description, group_type, created_by, created_at) VALUES (?,?,?,?,NULL,?)');
    foreach ($seeds as $s) {
        $ins->execute([$s[0], $s[1], $s[2], $s[3], $now]);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────

function json_out(array $a, int $code = 200): void {
    http_response_code($code);
    echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hdr(string $name): string {
    $map = [
        'X-FG-Token'        => 'HTTP_X_FG_TOKEN',
        'X-FG-SHA256'       => 'HTTP_X_FG_SHA256',
        'X-FG-Filename'     => 'HTTP_X_FG_FILENAME',
        'X-FG-Viewer-Token' => 'HTTP_X_FG_VIEWER_TOKEN',
        'Authorization'     => 'HTTP_AUTHORIZATION',
    ];
    $key = $map[$name] ?? '';
    return $key !== '' ? ($_SERVER[$key] ?? '') : '';
}

function prune_sessions(PDO $pdo): void {
    $t = time();
    $pdo->prepare('DELETE FROM fg_event WHERE device_token IN (SELECT device_token FROM fg_session WHERE expires_at < ?)')->execute([$t]);
    $pdo->prepare('DELETE FROM fg_log WHERE device_token IN (SELECT device_token FROM fg_session WHERE expires_at < ?)')->execute([$t]);
    $pdo->prepare('DELETE FROM fg_session WHERE expires_at < ?')->execute([$t]);
    $pdo->prepare('DELETE FROM comms_token WHERE expires_at < ?')->execute([$t]);
}

const LBS_DOMAIN = 'lbs-int.com';

function is_lbs_email(string $email): bool {
    return str_ends_with(strtolower($email), '@' . LBS_DOMAIN);
}

// ─────────────────────────────────────────────────────────────────────────
// Comms auth helpers
// ─────────────────────────────────────────────────────────────────────────

function comms_bearer(PDO $pdo): ?array {
    $auth = hdr('Authorization');
    if (!str_starts_with($auth, 'Bearer ')) return null;
    $tok = substr($auth, 7);
    $st  = $pdo->prepare('SELECT user_id FROM comms_token WHERE token = ? AND expires_at > ?');
    $st->execute([$tok, time()]);
    $uid = $st->fetchColumn();
    if (!$uid) return null;
    $us = $pdo->prepare('SELECT user_id, email, display_name, is_lbs_member FROM comms_user WHERE user_id = ?');
    $us->execute([$uid]);
    return $us->fetch(PDO::FETCH_ASSOC) ?: null;
}

function comms_require_auth(PDO $pdo): array {
    $user = comms_bearer($pdo);
    if (!$user) json_out(['ok' => false, 'error' => 'Unauthorized'], 401);
    return $user;
}

function comms_issue_token(PDO $pdo, string $userId): array {
    $token     = bin2hex(random_bytes(32));
    $expiresAt = time() + 86400 * 30;
    $pdo->prepare('INSERT INTO comms_token (token, user_id, expires_at, created_at) VALUES (?,?,?,?)')
        ->execute([$token, $userId, $expiresAt, time()]);
    return ['token' => $token, 'expiresAt' => gmdate('c', $expiresAt)];
}

function comms_auto_join(PDO $pdo, string $userId, bool $isLbs): void {
    $now    = time();
    $groups = $pdo->query("SELECT group_id, group_type FROM comms_group")->fetchAll(PDO::FETCH_ASSOC);
    $ins    = $pdo->prepare('INSERT OR IGNORE INTO comms_membership (group_id, user_id, role, joined_at) VALUES (?,?,?,?)');
    foreach ($groups as $g) {
        if ($g['group_type'] === 'lbs-internal' && !$isLbs) continue;
        if ($g['group_type'] === 'private') continue;
        $ins->execute([$g['group_id'], $userId, 'member', $now]);
    }
}

function comms_group_unread(PDO $pdo, string $uid, string $gid): int {
    $rp = $pdo->prepare('SELECT last_read_at FROM comms_read_pos WHERE user_id = ? AND group_id = ?');
    $rp->execute([$uid, $gid]);
    $lr = (int)($rp->fetchColumn() ?: 0);
    $uc = $pdo->prepare('SELECT COUNT(*) FROM comms_message WHERE group_id = ? AND created_at > ? AND from_user_id != ?');
    $uc->execute([$gid, $lr, $uid]);
    return (int)$uc->fetchColumn();
}

function comms_dm_unread(PDO $pdo, string $uid, string $dmId): int {
    $rp = $pdo->prepare('SELECT last_read_at FROM comms_dm_read_pos WHERE user_id = ? AND dm_id = ?');
    $rp->execute([$uid, $dmId]);
    $lr = (int)($rp->fetchColumn() ?: 0);
    $uc = $pdo->prepare('SELECT COUNT(*) FROM comms_dm_message WHERE dm_id = ? AND created_at > ? AND from_user_id != ?');
    $uc->execute([$dmId, $lr, $uid]);
    return (int)$uc->fetchColumn();
}

// ─────────────────────────────────────────────────────────────────────────
// Comms routing
// ─────────────────────────────────────────────────────────────────────────

function comms_route(PDO $pdo, string $path, string $method, array $body): void {

    // ── POST /comms/auth — open registration + login ──────────────────────
    if ($path === '/comms/auth' && $method === 'POST') {
        $email       = strtolower(trim($body['email'] ?? ''));
        $password    = (string)($body['password'] ?? '');
        $displayName = trim($body['displayName'] ?? '');
        $isRegister  = !empty($body['register']);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_out(['ok' => false, 'error' => 'Invalid email address'], 400);
        }
        if (strlen($password) < 8) {
            json_out(['ok' => false, 'error' => 'Password must be at least 8 characters'], 400);
        }

        $isLbs = is_lbs_email($email);

        $st = $pdo->prepare('SELECT user_id, password_hash, display_name, is_lbs_member FROM comms_user WHERE email = ?');
        $st->execute([$email]);
        $existing = $st->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            // Existing user — verify password
            if (!password_verify($password, (string)$existing['password_hash'])) {
                json_out(['ok' => false, 'error' => 'Invalid credentials'], 401);
            }
            if ($isRegister) {
                // Client sent register=true but account exists — treat as conflict
                json_out(['ok' => false, 'error' => 'Account already exists'], 409);
            }
            $userId      = $existing['user_id'];
            $displayName = $existing['display_name'];
            // Upgrade LBS flag if email domain changed (e.g. alias registration)
            if ($isLbs && !(int)$existing['is_lbs_member']) {
                $pdo->prepare('UPDATE comms_user SET is_lbs_member=1 WHERE user_id=?')->execute([$userId]);
            }
        } else {
            // New user
            if (!$isRegister) {
                json_out(['ok' => false, 'error' => 'No account found. Create an account first.'], 401);
            }
            if ($displayName === '') {
                // Derive display name from email local part
                $local = explode('@', $email)[0];
                $parts = preg_split('/[._\-]+/', $local);
                $displayName = implode(' ', array_map('ucfirst', $parts));
            }
            $userId = bin2hex(random_bytes(16));
            $hash   = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $pdo->prepare('INSERT INTO comms_user (user_id, email, display_name, password_hash, is_lbs_member, created_at) VALUES (?,?,?,?,?,?)')
                ->execute([$userId, $email, $displayName, $hash, $isLbs ? 1 : 0, time()]);
            comms_auto_join($pdo, $userId, $isLbs);
        }

        $tok = comms_issue_token($pdo, $userId);
        json_out([
            'ok'          => true,
            'token'       => $tok['token'],
            'userId'      => $userId,
            'displayName' => $displayName,
            'isLbsMember' => $isLbs,
            'expiresAt'   => $tok['expiresAt'],
        ]);
    }

    // ── POST /comms/keys/publish ──────────────────────────────────────────
    if ($path === '/comms/keys/publish' && $method === 'POST') {
        $user        = comms_require_auth($pdo);
        $armored     = (string)($body['publicKeyArmored'] ?? '');
        $fingerprint = strtolower(preg_replace('/[^a-fA-F0-9]/', '', (string)($body['fingerprint'] ?? '')));
        if ($armored === '' || $fingerprint === '') json_out(['ok' => false, 'error' => 'Missing key data'], 400);
        $pdo->prepare('INSERT OR REPLACE INTO comms_key (user_id, public_key_armored, fingerprint, updated_at) VALUES (?,?,?,?)')
            ->execute([$user['user_id'], $armored, $fingerprint, time()]);
        json_out(['ok' => true]);
    }

    // ── GET /comms/users/search?q=xxx ────────────────────────────────────
    if ($path === '/comms/users/search' && $method === 'GET') {
        comms_require_auth($pdo);
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) json_out(['ok' => true, 'users' => []]);
        $st = $pdo->prepare("SELECT user_id, display_name, is_lbs_member FROM comms_user WHERE display_name LIKE ? LIMIT 10");
        $st->execute(['%' . $q . '%']);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        json_out(['ok' => true, 'users' => array_map(fn($r) => [
            'userId'      => $r['user_id'],
            'displayName' => $r['display_name'],
            'isLbsMember' => (bool)(int)$r['is_lbs_member'],
        ], $rows)]);
    }

    // ── GET /comms/groups ─────────────────────────────────────────────────
    if ($path === '/comms/groups' && $method === 'GET') {
        $user = comms_require_auth($pdo);
        $uid  = $user['user_id'];

        $st = $pdo->prepare('
            SELECT g.group_id, g.name, g.description, g.group_type, g.created_by
            FROM comms_group g
            JOIN comms_membership m ON m.group_id = g.group_id AND m.user_id = ?
            ORDER BY g.name
        ');
        $st->execute([$uid]);
        $groups = $st->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($groups as $g) {
            $gid = $g['group_id'];
            $ms  = $pdo->prepare('
                SELECT u.user_id, u.display_name, u.is_lbs_member,
                       cm.role, COALESCE(k.fingerprint,"") AS fingerprint,
                       COALESCE(k.public_key_armored,"") AS publicKey
                FROM comms_membership cm
                JOIN comms_user u ON u.user_id = cm.user_id
                LEFT JOIN comms_key k ON k.user_id = cm.user_id
                WHERE cm.group_id = ? ORDER BY u.display_name
            ');
            $ms->execute([$gid]);
            $members = $ms->fetchAll(PDO::FETCH_ASSOC);

            $result[] = [
                'groupId'     => $gid,
                'name'        => $g['name'],
                'description' => $g['description'],
                'groupType'   => $g['group_type'],
                'createdBy'   => $g['created_by'],
                'members'     => array_map(fn($m) => [
                    'userId'      => $m['user_id'],
                    'displayName' => $m['display_name'],
                    'isLbsMember' => (bool)(int)$m['is_lbs_member'],
                    'fingerprint' => $m['fingerprint'],
                    'publicKey'   => $m['publicKey'],
                    'online'      => false,
                ], $members),
                'unreadCount' => comms_group_unread($pdo, $uid, $gid),
            ];
        }
        json_out(['ok' => true, 'groups' => $result]);
    }

    // ── POST /comms/groups/create ─────────────────────────────────────────
    if ($path === '/comms/groups/create' && $method === 'POST') {
        $user      = comms_require_auth($pdo);
        $name      = trim($body['name'] ?? '');
        $desc      = trim($body['description'] ?? '');
        $isPrivate = !empty($body['isPrivate']);

        if ($name === '') json_out(['ok' => false, 'error' => 'Name is required'], 400);
        if (strlen($name) > 80) json_out(['ok' => false, 'error' => 'Name too long'], 400);

        $groupId   = bin2hex(random_bytes(8));
        $groupType = $isPrivate ? 'private' : 'public';
        $pdo->prepare('INSERT INTO comms_group (group_id, name, description, group_type, created_by, created_at) VALUES (?,?,?,?,?,?)')
            ->execute([$groupId, $name, $desc, $groupType, $user['user_id'], time()]);
        // Creator auto-joins as admin
        $pdo->prepare('INSERT INTO comms_membership (group_id, user_id, role, joined_at) VALUES (?,?,?,?)')
            ->execute([$groupId, $user['user_id'], 'admin', time()]);

        json_out(['ok' => true, 'groupId' => $groupId]);
    }

    // ── POST /comms/groups/{id}/invite ────────────────────────────────────
    if (preg_match('#^/comms/groups/([^/]+)/invite$#', $path, $m) && $method === 'POST') {
        $user      = comms_require_auth($pdo);
        $gid       = $m[1];
        $targetUid = trim($body['userId'] ?? '');

        // Must be admin or LBS member for lbs-internal groups
        $gr = $pdo->prepare('SELECT group_type FROM comms_group WHERE group_id = ?');
        $gr->execute([$gid]);
        $grp = $gr->fetch(PDO::FETCH_ASSOC);
        if (!$grp) json_out(['ok' => false, 'error' => 'Group not found'], 404);

        $myRole = $pdo->prepare('SELECT role FROM comms_membership WHERE group_id=? AND user_id=?');
        $myRole->execute([$gid, $user['user_id']]);
        $role = $myRole->fetchColumn();

        if ($grp['group_type'] === 'lbs-internal' && !(bool)(int)$user['is_lbs_member']) {
            json_out(['ok' => false, 'error' => 'Only LBS members can invite to internal groups'], 403);
        }
        if ($role !== 'admin' && $grp['group_type'] === 'private') {
            json_out(['ok' => false, 'error' => 'Only admins can invite to private groups'], 403);
        }
        if (!$role) json_out(['ok' => false, 'error' => 'Not a member'], 403);

        $pdo->prepare('INSERT OR IGNORE INTO comms_membership (group_id, user_id, role, joined_at) VALUES (?,?,?,?)')
            ->execute([$gid, $targetUid, 'member', time()]);
        json_out(['ok' => true]);
    }

    // ── GET /comms/groups/{id}/messages ──────────────────────────────────
    if (preg_match('#^/comms/groups/([^/]+)/messages$#', $path, $m) && $method === 'GET') {
        $user = comms_require_auth($pdo);
        $gid  = $m[1];
        $uid  = $user['user_id'];

        $check = $pdo->prepare('SELECT 1 FROM comms_membership WHERE group_id=? AND user_id=?');
        $check->execute([$gid, $uid]);
        if (!$check->fetchColumn()) json_out(['ok' => false, 'error' => 'Not a member'], 403);

        $since = isset($_GET['since']) ? (int)strtotime($_GET['since']) : 0;
        $st    = $pdo->prepare('SELECT msg_id,group_id,from_user_id,ciphertext,created_at FROM comms_message WHERE group_id=? AND created_at>? ORDER BY created_at ASC LIMIT 200');
        $st->execute([$gid, $since]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $pdo->prepare('INSERT OR REPLACE INTO comms_read_pos (user_id,group_id,last_read_at) VALUES (?,?,?)')->execute([$uid,$gid,time()]);

        $nameCache = [];
        $messages  = array_map(function ($r) use ($pdo, &$nameCache) {
            $fid = $r['from_user_id'];
            if (!isset($nameCache[$fid])) {
                $s = $pdo->prepare('SELECT display_name FROM comms_user WHERE user_id=?');
                $s->execute([$fid]);
                $nameCache[$fid] = (string)($s->fetchColumn() ?: '');
            }
            return [
                'msgId'           => $r['msg_id'],
                'groupId'         => $r['group_id'],
                'fromUserId'      => $r['from_user_id'],
                'fromDisplayName' => $nameCache[$fid],
                'timestamp'       => gmdate('c', (int)$r['created_at']),
                'ciphertext'      => $r['ciphertext'],
            ];
        }, $rows);

        json_out(['ok' => true, 'messages' => $messages]);
    }

    // ── POST /comms/groups/{id}/messages ─────────────────────────────────
    if (preg_match('#^/comms/groups/([^/]+)/messages$#', $path, $m) && $method === 'POST') {
        $user = comms_require_auth($pdo);
        $gid  = $m[1];
        $uid  = $user['user_id'];

        $check = $pdo->prepare('SELECT 1 FROM comms_membership WHERE group_id=? AND user_id=?');
        $check->execute([$gid, $uid]);
        if (!$check->fetchColumn()) json_out(['ok' => false, 'error' => 'Not a member'], 403);

        $ciphertext = (string)($body['ciphertext'] ?? '');
        if (strlen($ciphertext) < 10) json_out(['ok' => false, 'error' => 'Missing ciphertext'], 400);
        if (strlen($ciphertext) > 2 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Message too large'], 413);

        $msgId = bin2hex(random_bytes(16));
        $now   = time();
        $pdo->prepare('INSERT INTO comms_message (msg_id,group_id,from_user_id,ciphertext,created_at) VALUES (?,?,?,?,?)')->execute([$msgId,$gid,$uid,$ciphertext,$now]);
        $pdo->prepare('INSERT OR REPLACE INTO comms_read_pos (user_id,group_id,last_read_at) VALUES (?,?,?)')->execute([$uid,$gid,$now]);
        json_out(['ok' => true, 'msgId' => $msgId, 'timestamp' => gmdate('c', $now)]);
    }

    // ── GET /comms/keys/{userId} ─────────────────────────────────────────
    if (preg_match('#^/comms/keys/([^/]+)$#', $path, $m) && $method === 'GET') {
        comms_require_auth($pdo);
        $st = $pdo->prepare('SELECT public_key_armored, fingerprint FROM comms_key WHERE user_id=?');
        $st->execute([$m[1]]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) json_out(['ok' => false, 'error' => 'Key not found'], 404);
        json_out(['ok' => true, 'publicKeyArmored' => $row['public_key_armored'], 'fingerprint' => $row['fingerprint']]);
    }

    // ── POST /comms/keys/publish ─ (duplicate path guard handled above) ──

    // ── POST /comms/dms/open ─────────────────────────────────────────────
    if ($path === '/comms/dms/open' && $method === 'POST') {
        $user   = comms_require_auth($pdo);
        $uid    = $user['user_id'];
        $peerId = trim($body['userId'] ?? '');
        if (!$peerId || $peerId === $uid) json_out(['ok' => false, 'error' => 'Invalid peer'], 400);

        // Check peer exists
        $peerCheck = $pdo->prepare('SELECT 1 FROM comms_user WHERE user_id=?');
        $peerCheck->execute([$peerId]);
        if (!$peerCheck->fetchColumn()) json_out(['ok' => false, 'error' => 'User not found'], 404);

        // Find existing DM (order-independent)
        $a = min($uid, $peerId);
        $b = max($uid, $peerId);
        $st = $pdo->prepare('SELECT dm_id FROM comms_dm WHERE min(user_a,user_b)=? AND max(user_a,user_b)=?');
        $st->execute([$a, $b]);
        $existing = $st->fetchColumn();

        if ($existing) {
            json_out(['ok' => true, 'dmId' => $existing]);
        } else {
            $dmId = bin2hex(random_bytes(12));
            $pdo->prepare('INSERT INTO comms_dm (dm_id,user_a,user_b,created_at) VALUES (?,?,?,?)')->execute([$dmId,$uid,$peerId,time()]);
            json_out(['ok' => true, 'dmId' => $dmId]);
        }
    }

    // ── GET /comms/dms ───────────────────────────────────────────────────
    if ($path === '/comms/dms' && $method === 'GET') {
        $user = comms_require_auth($pdo);
        $uid  = $user['user_id'];

        $st = $pdo->prepare('SELECT dm_id, user_a, user_b FROM comms_dm WHERE user_a=? OR user_b=? ORDER BY created_at DESC');
        $st->execute([$uid, $uid]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $dms = [];
        foreach ($rows as $r) {
            $peerId = $r['user_a'] === $uid ? $r['user_b'] : $r['user_a'];
            $ps = $pdo->prepare('SELECT user_id, display_name, is_lbs_member FROM comms_user WHERE user_id=?');
            $ps->execute([$peerId]);
            $peer = $ps->fetch(PDO::FETCH_ASSOC);
            if (!$peer) continue;
            $dms[] = [
                'dmId'        => $r['dm_id'],
                'peer'        => [
                    'userId'      => $peer['user_id'],
                    'displayName' => $peer['display_name'],
                    'isLbsMember' => (bool)(int)$peer['is_lbs_member'],
                ],
                'unreadCount' => comms_dm_unread($pdo, $uid, $r['dm_id']),
            ];
        }
        json_out(['ok' => true, 'dms' => $dms]);
    }

    // ── GET /comms/dms/{id}/messages ─────────────────────────────────────
    if (preg_match('#^/comms/dms/([^/]+)/messages$#', $path, $m) && $method === 'GET') {
        $user = comms_require_auth($pdo);
        $uid  = $user['user_id'];
        $dmId = $m[1];

        $check = $pdo->prepare('SELECT 1 FROM comms_dm WHERE dm_id=? AND (user_a=? OR user_b=?)');
        $check->execute([$dmId, $uid, $uid]);
        if (!$check->fetchColumn()) json_out(['ok' => false, 'error' => 'Not found'], 404);

        $since = isset($_GET['since']) ? (int)strtotime($_GET['since']) : 0;
        $st    = $pdo->prepare('SELECT msg_id,dm_id,from_user_id,ciphertext,created_at FROM comms_dm_message WHERE dm_id=? AND created_at>? ORDER BY created_at ASC LIMIT 200');
        $st->execute([$dmId, $since]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $pdo->prepare('INSERT OR REPLACE INTO comms_dm_read_pos (user_id,dm_id,last_read_at) VALUES (?,?,?)')->execute([$uid,$dmId,time()]);

        $messages = array_map(fn($r) => [
            'msgId'       => $r['msg_id'],
            'dmId'        => $r['dm_id'],
            'fromUserId'  => $r['from_user_id'],
            'timestamp'   => gmdate('c', (int)$r['created_at']),
            'ciphertext'  => $r['ciphertext'],
        ], $rows);

        json_out(['ok' => true, 'messages' => $messages]);
    }

    // ── POST /comms/dms/{id}/messages ────────────────────────────────────
    if (preg_match('#^/comms/dms/([^/]+)/messages$#', $path, $m) && $method === 'POST') {
        $user = comms_require_auth($pdo);
        $uid  = $user['user_id'];
        $dmId = $m[1];

        $check = $pdo->prepare('SELECT 1 FROM comms_dm WHERE dm_id=? AND (user_a=? OR user_b=?)');
        $check->execute([$dmId, $uid, $uid]);
        if (!$check->fetchColumn()) json_out(['ok' => false, 'error' => 'Not found'], 404);

        $ciphertext = (string)($body['ciphertext'] ?? '');
        if (strlen($ciphertext) < 10) json_out(['ok' => false, 'error' => 'Missing ciphertext'], 400);
        if (strlen($ciphertext) > 2 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Message too large'], 413);

        $msgId = bin2hex(random_bytes(16));
        $now   = time();
        $pdo->prepare('INSERT INTO comms_dm_message (msg_id,dm_id,from_user_id,ciphertext,created_at) VALUES (?,?,?,?,?)')->execute([$msgId,$dmId,$uid,$ciphertext,$now]);
        $pdo->prepare('INSERT OR REPLACE INTO comms_dm_read_pos (user_id,dm_id,last_read_at) VALUES (?,?,?)')->execute([$uid,$dmId,$now]);
        json_out(['ok' => true, 'msgId' => $msgId, 'timestamp' => gmdate('c', $now)]);
    }

    json_out(['ok' => false, 'error' => 'Unknown comms route'], 404);
}

// ─────────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────────

try {
    prune_sessions($pdo);

    $pathInfo = $_SERVER['PATH_INFO'] ?? '';
    $method   = $_SERVER['REQUEST_METHOD'];

    if (str_starts_with($pathInfo, '/comms')) {
        comms_route($pdo, $pathInfo, $method, $jsonIn);
        exit;
    }

    // ── App version endpoint (used by in-app auto-update checker) ─────────
    if ($pathInfo === '/app/version' && $method === 'GET') {
        $localVer  = trim((string)@file_get_contents(dirname(__DIR__) . '/_data/local/VERSION'));
        $version   = ltrim($localVer ?: '1.1.0', 'v');
        $apkPath   = dirname(__DIR__) . '/_data/local/FieldGuard.apk';
        $published = is_file($apkPath) ? gmdate('c', (int)filemtime($apkPath)) : gmdate('c');
        json_out([
            'version'      => $version,
            'versionCode'  => (int)preg_replace('/[^0-9]/', '', $version),
            'downloadUrl'  => 'https://fieldguard.lbs-int.com/dl/android',
            'releaseNotes' => 'Secure Comms — E2EE group messaging, 1:1 DMs, open registration with LBS member badges.',
            'publishedAt'  => $published,
        ]);
        exit;
    }

    // ── PC Bridge action routes ───────────────────────────────────────────
    $action = $_GET['action'] ?? '';

    if ($action === 'session_create' && $method === 'POST') {
        $deviceId  = isset($jsonIn['device_id']) ? (string)$jsonIn['device_id'] : 'unknown';
        $pin       = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token     = bin2hex(random_bytes(24));
        $sessionId = bin2hex(random_bytes(8));
        $exp       = time() + 86400 * 7;
        $now       = time();
        $pdo->prepare('INSERT INTO fg_session (device_token,viewer_token,pin,session_id,pc_connected,expires_at,device_id,created_at) VALUES (?,?,?,?,0,?,?,?)')
            ->execute([$token, null, $pin, $sessionId, $exp, $deviceId, $now]);
        json_out(['ok' => true, 'pin' => $pin, 'token' => $token, 'expires_at' => gmdate('c', $exp), 'session_id' => $sessionId, 'pc_connected' => false]);
    }

    if ($action === 'session_status' && $method === 'GET') {
        $tok = hdr('X-FG-Token');
        if ($tok === '') json_out(['ok' => false, 'error' => 'missing token'], 400);
        $st = $pdo->prepare('SELECT pc_connected FROM fg_session WHERE device_token=? AND expires_at>?');
        $st->execute([$tok, time()]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) json_out(['ok' => false, 'error' => 'unknown session'], 404);
        json_out(['ok' => true, 'pc_connected' => (bool)(int)$row['pc_connected']]);
    }

    if ($action === 'push_events' && $method === 'POST') {
        $tok = hdr('X-FG-Token');
        if ($tok === '') json_out(['ok' => false, 'error' => 'missing token'], 400);
        $st = $pdo->prepare('SELECT id FROM fg_session WHERE device_token=? AND expires_at>?');
        $st->execute([$tok, time()]);
        if (!$st->fetchColumn()) json_out(['ok' => false, 'error' => 'unknown session'], 404);
        $events = $jsonIn['events'] ?? [];
        if (!is_array($events)) json_out(['ok' => false, 'error' => 'invalid events'], 400);
        $ins = $pdo->prepare('INSERT INTO fg_event (device_token,payload,created_at) VALUES (?,?,?)');
        $now = time();
        foreach ($events as $ev) { $ins->execute([$tok, json_encode($ev, JSON_UNESCAPED_UNICODE), $now]); }
        json_out(['ok' => true, 'stored' => count($events)]);
    }

    if ($action === 'pc_join' && $method === 'POST') {
        $pin = preg_replace('/\D/', '', (string)($jsonIn['pin'] ?? ''));
        if (strlen($pin) !== 6) json_out(['ok' => false, 'error' => 'PIN must be 6 digits'], 400);
        $st = $pdo->prepare('SELECT id FROM fg_session WHERE pin=? AND expires_at>?');
        $st->execute([$pin, time()]);
        $id = $st->fetchColumn();
        if (!$id) json_out(['ok' => false, 'error' => 'invalid or expired PIN'], 403);
        $viewerToken = bin2hex(random_bytes(24));
        $pdo->prepare('UPDATE fg_session SET pc_connected=1, viewer_token=? WHERE id=? AND pin=?')->execute([$viewerToken, $id, $pin]);
        json_out(['ok' => true, 'viewer_token' => $viewerToken]);
    }

    if ($action === 'fetch_events' && $method === 'GET') {
        $vt = hdr('X-FG-Viewer-Token');
        if ($vt === '') json_out(['ok' => false, 'error' => 'missing viewer token'], 400);
        $st = $pdo->prepare('SELECT device_token FROM fg_session WHERE viewer_token=? AND expires_at>?');
        $st->execute([$vt, time()]);
        $dt = $st->fetchColumn();
        if (!$dt) json_out(['ok' => false, 'error' => 'unknown viewer'], 404);
        $after = max(0, (int)($_GET['after_id'] ?? 0));
        $ev = $pdo->prepare('SELECT id,payload,created_at FROM fg_event WHERE device_token=? AND id>? ORDER BY id ASC LIMIT 200');
        $ev->execute([$dt, $after]);
        $rows = $ev->fetchAll(PDO::FETCH_ASSOC);
        $out = []; $maxId = $after;
        foreach ($rows as $r) {
            $maxId = max($maxId, (int)$r['id']);
            $out[] = ['id' => (int)$r['id'], 'payload' => json_decode($r['payload'], true), 'created_at' => (int)$r['created_at']];
        }
        json_out(['ok' => true, 'events' => $out, 'after_id' => $maxId]);
    }

    if ($action === 'upload_log' && $method === 'POST') {
        $tok = hdr('X-FG-Token');
        if ($tok === '') json_out(['ok' => false, 'error' => 'missing token'], 400);
        $st = $pdo->prepare('SELECT id FROM fg_session WHERE device_token=? AND expires_at>?');
        $st->execute([$tok, time()]);
        if (!$st->fetchColumn()) json_out(['ok' => false, 'error' => 'unknown session'], 404);
        $sha = strtolower(hdr('X-FG-SHA256'));
        $size = strlen($rawIn);
        $pdo->prepare('INSERT INTO fg_log (device_token,sha256,body,size_bytes,created_at) VALUES (?,?,?,?,?)')->execute([$tok,$sha,$rawIn,$size,time()]);
        json_out(['ok' => true, 'log_id' => (int)$pdo->lastInsertId(), 'size_bytes' => $size]);
    }

    if ($action === 'confirm_upload' && $method === 'GET') {
        $tok   = hdr('X-FG-Token');
        $logId = (int)($_GET['log_id'] ?? 0);
        if ($tok === '' || $logId <= 0) json_out(['ok' => false, 'error' => 'bad request'], 400);
        $st = $pdo->prepare('SELECT sha256, body FROM fg_log WHERE id=? AND device_token=?');
        $st->execute([$logId, $tok]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) json_out(['ok' => false, 'error' => 'log not found'], 404);
        $stored = hash('sha256', $row['body']);
        $match  = $row['sha256'] !== '' && hash_equals($stored, strtolower($row['sha256']));
        json_out(['ok' => true, 'safe_to_clear' => $match, 'stored_sha' => $stored]);
    }

    json_out(['ok' => false, 'error' => 'unknown action'], 404);

} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'server error: ' . $e->getMessage()], 500);
}
