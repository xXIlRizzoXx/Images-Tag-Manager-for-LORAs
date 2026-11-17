import ponte from '../../electron/claude-bridge.cjs?raw';

export const NOME_FILE_ESTENSIONE = 'images-tag-manager.mcpb';

// ITALIANO: il manifest del file .mcpb. Il codice segreto NON sta qui: lo chiede Claude
//           all'installazione e lo conserva lui, quindi il file si puo' tenere e passare senza rischi.
// ENGLISH: the manifest of the .mcpb file. The secret token is NOT here: Claude asks for it on
//          install and keeps it, so the file can be kept and passed around safely.
export const manifestEstensione = (versione: string, indirizzo: string) => ({
    manifest_version: '0.3',
    name: 'images-tag-manager',
    display_name: 'Images Tag Manager for LORAs',
    version: versione,
    description: 'Lets Claude see the photos open in Images Tag Manager for LORAs and change their tags.',
    author: { name: 'xXIlRizzoXx', url: 'https://github.com/xXIlRizzoXx' },
    repository: { type: 'git', url: 'https://github.com/xXIlRizzoXx/Images-Tag-Manager-for-LORAs' },
    license: 'MIT',
    server: {
        type: 'node',
        entry_point: 'server/index.js',
        mcp_config: {
            command: 'node',
            args: ['${__dirname}/server/index.js'],
            env: { ITM_URL: indirizzo, ITM_TOKEN: '${user_config.token}' },
        },
    },
    user_config: {
        token: {
            type: 'string',
            title: 'Secret token',
            description: 'Copy it from Images Tag Manager for LORAs: Settings, MCP server.',
            sensitive: true,
            required: true,
        },
    },
    tools_generated: true,
    compatibility: { platforms: ['win32', 'darwin', 'linux'], runtimes: { node: '>=16.0.0' } },
});

// ITALIANO: un .mcpb e' uno ZIP con manifest.json alla radice.
// ENGLISH: a .mcpb is a ZIP with manifest.json at its root.
export const creaEstensioneClaude = async (versione: string, indirizzo: string): Promise<Uint8Array> => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifestEstensione(versione, indirizzo), null, 2));
    zip.file('server/index.js', ponte);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};
