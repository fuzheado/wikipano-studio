#!/usr/bin/env node

/**
 * validate-pannellum.mjs — Validate a Pannellum tour/config JSON
 * against the official Pannellum JSON Schema.
 *
 * Usage:
 *   node scripts/validate-pannellum.mjs <file.json>
 *   node scripts/validate-pannellum.mjs <file.json> --fix   (auto-normalize fixable issues)
 *   node scripts/validate-pannellum.mjs <file.json> --raw   (also show raw schema validation errors)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

// ── Load schema ─────────────────────────────────────────────────────────────

const skillDir = resolve(process.env.HOME, '.pi', 'agent', 'skills', 'pannellum');
const schemaPath = resolve(skillDir, 'reference', 'json-config-schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

const validate = ajv.compile(schema);

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const doFix = args.includes('--fix');
const showRaw = args.includes('--raw');

if (!filePath) {
    console.error('Usage: node validate-pannellum.mjs <file.json> [--fix] [--raw]');
    process.exit(1);
}

const inputPath = resolve(filePath);
let json;
try {
    json = JSON.parse(readFileSync(inputPath, 'utf-8'));
} catch (e) {
    console.error(`❌ Invalid JSON: ${e.message}`);
    process.exit(1);
}

// ── Type detection ──────────────────────────────────────────────────────────

const isTour = json.scenes && json.default;
const isStandalone = json.type && !json.scenes;

// Schema errors to suppress (noise from the non-matching oneOf variant)
const PANO_ONLY_KEYS = ['panorama', 'cubeMap', 'multiRes', 'type'];
const TOUR_ONLY_KEYS = ['default', 'scenes', 'firstScene'];

// ── Schema validation ───────────────────────────────────────────────────────

const valid = validate(json);
let issues = [];
let fixes = [];

if (!valid && validate.errors) {
    for (const e of validate.errors) {
        const path = e.instancePath || '(root)';

        // Suppress oneOf noise: errors from the variant that doesn't match
        if (e.keyword === 'required' && path === '(root)') {
            const missingParam = e.params?.missingProperty;
            if (isTour && PANO_ONLY_KEYS.includes(missingParam)) continue;
            if (isStandalone && TOUR_ONLY_KEYS.includes(missingParam)) continue;
        }
        if (e.keyword === 'if' && path === '(root)') continue;
        if (e.keyword === 'oneOf' && path === '(root)') continue;

        issues.push({
            path,
            message: e.message,
            keyword: e.keyword,
            params: e.params,
        });
    }
}

if (!isTour && !isStandalone) {
    issues.push({
        path: '(root)',
        message: 'Must be either a tour config (with "default" + "scenes") or a standalone panorama config (with "type")',
        keyword: 'semantic',
    });
}

if (isTour) {
    const firstScene = json.default?.firstScene;
    if (firstScene && json.scenes && !json.scenes[firstScene]) {
        issues.push({
            path: '/default/firstScene',
            message: `firstScene "${firstScene}" does not match any scene ID`,
            keyword: 'semantic',
        });
    }

    // Cross-reference sceneId in hot spots
    for (const [sceneId, scene] of Object.entries(json.scenes || {})) {
        if (!scene.hotSpots) continue;
        for (let i = 0; i < scene.hotSpots.length; i++) {
            const hs = scene.hotSpots[i];
            const hsPath = `/scenes/${sceneId}/hotSpots/${i}`;

            if (hs.type === 'scene' && hs.sceneId && !json.scenes[hs.sceneId]) {
                issues.push({
                    path: `${hsPath}/sceneId`,
                    message: `Target scene "${hs.sceneId}" does not exist in scenes`,
                    keyword: 'semantic',
                });
            }
        }
    }

    // Yaw normalization: Pannellum handles out-of-range yaw, but spec says [-180, 180]
    for (const [sceneId, scene] of Object.entries(json.scenes || {})) {
        if (!scene.hotSpots) continue;
        for (let i = 0; i < scene.hotSpots.length; i++) {
            const hs = scene.hotSpots[i];
            const hsPath = `/scenes/${sceneId}/hotSpots/${i}`;
            if (typeof hs.yaw === 'number') {
                if (hs.yaw < -180 || hs.yaw > 180) {
                    const original = hs.yaw;
                    const normalized = ((hs.yaw % 360) + 540) % 360 - 180;
                    issues.push({
                        path: `${hsPath}/yaw`,
                        message: `Yaw ${hs.yaw}° is outside [-180, 180] — should be ${normalized.toFixed(3)}°`,
                        keyword: 'yaw-range',
                        fixable: true,
                        original,
                        normalized,
                        sceneId,
                        hotspotIndex: i,
                    });
                    if (doFix) {
                        hs.yaw = normalized;
                        fixes.push(`${hsPath}/yaw: ${original} → ${normalized.toFixed(3)}`);
                    }
                }
            }
        }
    }

    // URL validation (spaces, encoding)
    for (const [sceneId, scene] of Object.entries(json.scenes || {})) {
        if (!scene.hotSpots) continue;
        for (let i = 0; i < scene.hotSpots.length; i++) {
            const hs = scene.hotSpots[i];
            if (hs.URL && /\s/.test(hs.URL)) {
                const hsPath = `/scenes/${sceneId}/hotSpots/${i}`;
                const encoded = encodeURI(hs.URL);
                issues.push({
                    path: `${hsPath}/URL`,
                    message: `URL contains spaces — should be "${encoded}"`,
                    keyword: 'url-encoding',
                    fixable: true,
                    original: hs.URL,
                    normalized: encoded,
                    sceneId,
                    hotspotIndex: i,
                });
                if (doFix) {
                    hs.URL = encoded;
                    fixes.push(`${hsPath}/URL: "${hs.URL}" → "${encoded}"`);
                }
            }
        }
    }
}

// ── Report ──────────────────────────────────────────────────────────────────

const totalIssues = issues.length;
const fixableCount = issues.filter(i => i.fixable).length;

console.log(`\n🔍 Pannellum JSON Validator`);
console.log(`   File: ${inputPath}`);
console.log(`   Type: ${isTour ? 'Virtual Tour' : isStandalone ? 'Standalone Panorama' : 'Unknown'}\n`);

if (totalIssues === 0) {
    console.log(`✅ Valid — no issues found.\n`);
} else {
    console.log(`❌ ${totalIssues} issue(s) found${fixableCount > 0 ? ` (${fixableCount} fixable)` : ''}:\n`);

    for (const issue of issues) {
        const emoji = issue.fixable ? '🟡' : '🔴';
        console.log(`   ${emoji} ${issue.path}`);
        console.log(`      ${issue.message}`);
    }

    if (showRaw && validate.errors) {
        console.log(`\n   ── Raw schema errors ──`);
        for (const e of validate.errors) {
            console.log(`      ${e.instancePath || '(root)'}: ${e.message} [${e.keyword}]`);
        }
    }

    if (doFix && fixes.length > 0) {
        writeFileSync(inputPath, JSON.stringify(json, null, 2) + '\n');
        console.log(`\n🔧 ${fixes.length} fix(es) applied:\n`);
        for (const f of fixes) console.log(`   ${f}`);
        console.log(`\n💾 Saved to ${inputPath}\n`);
    } else if (fixableCount > 0 && !doFix) {
        console.log(`\n💡 Run with --fix to auto-correct fixable issues.\n`);
    }

    process.exit(doFix ? 0 : 1);
}
