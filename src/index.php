<?php

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$body = json_decode(file_get_contents('php://input'), true) ?? [];

function requireIfExists(string $file): bool
{
    if (file_exists($file)) {
        require $file;
        return true;
    }
    return false;
}

switch ($uri) {
    case '/api/scan':
        if (!requireIfExists(__DIR__ . '/Scanner.php') || !requireIfExists(__DIR__ . '/Whitelist.php')) {
            echo json_encode(['error' => '功能未实现: Scanner.php']);
            exit;
        }
        if (!Whitelist::check($body['path'] ?? '')) {
            echo json_encode(['error' => '路径不在白名单或不存在']);
            exit;
        }
        $files = (new Scanner())->scan($body['path'], $body['exts'] ?? []);
        echo json_encode(['files' => $files]);
        break;

    case '/api/preview':
        if (!requireIfExists(__DIR__ . '/RenameEngine.php')) {
            echo json_encode(['error' => '功能未实现: RenameEngine.php']);
            exit;
        }
        $engine = new RenameEngine();
        $mappings = $engine->preview($body['path'] ?? '', $body['files'] ?? [], $body['rules'] ?? []);
        echo json_encode(['mappings' => $mappings]);
        break;

    case '/api/execute':
        if (!requireIfExists(__DIR__ . '/Executor.php') || !requireIfExists(__DIR__ . '/Log.php')) {
            echo json_encode(['error' => '功能未实现: Executor.php']);
            exit;
        }
        $executor = new Executor();
        $results = $executor->execute($body['path'] ?? '', $body['mappings'] ?? [], $body['dryRun'] ?? true);
        echo json_encode($results);
        break;

    case '/api/logs':
        if (!requireIfExists(__DIR__ . '/Log.php')) {
            echo json_encode(['error' => '功能未实现: Log.php']);
            exit;
        }
        $logs = Log::list();
        echo json_encode(['logs' => $logs]);
        break;

    case '/api/rollback':
        if (!requireIfExists(__DIR__ . '/Log.php')) {
            echo json_encode(['error' => '功能未实现: Log.php']);
            exit;
        }
        $result = Log::rollback($body['logId'] ?? '');
        echo json_encode($result);
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'API Not Found']);
}
