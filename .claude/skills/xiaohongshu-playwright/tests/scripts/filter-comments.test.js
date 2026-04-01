'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runScript, SKILL_DIR } = require('../helpers/run-script');
const { cleanAll, writeJson, DATA_DIR } = require('../helpers/cleanup');
const { makeTaskSpec } = require('../helpers/fixtures');

const KW = 'XTEST_FILTER_X';
const COMMENTS_FILE = path.join(DATA_DIR, `comments_${KW}.json`);
const CANDIDATES_FILE = path.join(DATA_DIR, `candidates_${KW}.json`);
const TASK_SPEC_FILE = path.join(DATA_DIR, 'task-specs', `2000-01-01T00-00-00_${KW}.json`);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function setupFixtures() {
  cleanAll(KW);
  const taskSpec = makeTaskSpec(KW, {
    keyword: KW,
    post_relevance: { include: ['医美', '热玛吉'], exclude: ['避雷'] },
    comment_filter: { include: ['多少钱', '想做', '求推荐'], exclude: ['加我微信', '我是做医美的'] },
  });
  writeJson(TASK_SPEC_FILE, taskSpec);

  // 自定义 comments fixture:
  // Post1：标题含 include 词"医美"，有各类需要被过滤的评论
  // Post2：标题只含 exclude 词"避雷"，无 include 词 → 应进入 skippedPosts
  // Post3：标题同时命中 include="医美" 和 exclude="避雷" → 当前产品逻辑应保留
  const comments = {
    keyword: KW,
    scrapeTime: new Date().toISOString(),
    posts: [
      {
        title: '医美体验分享',
        url: 'https://www.xiaohongshu.com/explore/aaaaaa000000000001',
        noteId: 'aaaaaa000000000001',
        author: 'test_author_001',
        commentCount: '5',
        comments: [
          { username: 'user_want_001', userId: 'uid_want_001', content: '多少钱啊，我也想做', ipLocation: '上海', profileUrl: 'https://x.com/u/uid_want_001', isSubComment: false, subCommentCount: '0', likes: '2' },
          { username: 'user_emoji_001', userId: 'uid_emoji_001', content: '😍😍😍', ipLocation: '北京', profileUrl: 'https://x.com/u/uid_emoji_001', isSubComment: false, subCommentCount: '0', likes: '0' },
          { username: 'user_ad_001', userId: 'uid_ad_001', content: '需要的加我微信', ipLocation: '广州', profileUrl: 'https://x.com/u/uid_ad_001', isSubComment: false, subCommentCount: '0', likes: '0' },
          { username: 'test_author_001', userId: 'uid_author_001', content: '谢谢大家支持', ipLocation: '上海', profileUrl: 'https://x.com/u/uid_author_001', isSubComment: false, subCommentCount: '0', likes: '0' },
          { username: 'user_mention_001', userId: 'uid_mention_001', content: '@test_author_001 ', ipLocation: '深圳', profileUrl: 'https://x.com/u/uid_mention_001', isSubComment: false, subCommentCount: '0', likes: '0' },
        ],
      },
      {
        // Post2：标题含 exclude="避雷"，不含 include=["医美","热玛吉"]，评论也不含 include 词
        // → isRelevantPost: exclude 命中 + include 未命中 → keep: false → skippedPosts
        title: '避雷！某护肤店',
        url: 'https://www.xiaohongshu.com/explore/bbbbbb000000000002',
        noteId: 'bbbbbb000000000002',
        author: 'test_author_002',
        commentCount: '1',
        comments: [
          { username: 'user_normal_001', userId: 'uid_normal_001', content: '这家真的太坑了', ipLocation: '北京', profileUrl: 'https://x.com/u/uid_normal_001', isSubComment: false, subCommentCount: '0', likes: '5' },
        ],
      },
      {
        // Post3：标题同时命中 include 和 exclude，按当前业务规则应保留
        title: '避雷！某医美机构',
        url: 'https://www.xiaohongshu.com/explore/cccccc000000000003',
        noteId: 'cccccc000000000003',
        author: 'test_author_003',
        commentCount: '1',
        comments: [
          { username: 'user_mixed_001', userId: 'uid_mixed_001', content: '求推荐别踩坑', ipLocation: '深圳', profileUrl: 'https://x.com/u/uid_mixed_001', isSubComment: false, subCommentCount: '0', likes: '3' },
        ],
      },
    ],
  };
  writeJson(COMMENTS_FILE, comments);
}

// ─── 前置清理 ────────────────────────────────────────────────────────────────
cleanAll(KW);
console.log('\n=== filter-comments.js 测试 ===\n');

// TC-FILTER-001 正常粗筛输出结构
test('TC-FILTER-001 正常粗筛输出完整结构', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0, `exit code 应为 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
    assert.ok(fs.existsSync(CANDIDATES_FILE), 'candidates 文件应存在');

    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
    assert.ok(obj.keyword !== undefined, '应包含 keyword');
    assert.ok(obj.taskSpecPath !== undefined, '应包含 taskSpecPath');
    assert.ok(obj.taskSpec !== undefined, '应包含 taskSpec');
    assert.ok(Array.isArray(obj.posts), '应包含 posts 数组');
    assert.ok(Array.isArray(obj.skippedPosts), '应包含 skippedPosts 数组');
    assert.ok(obj.stats !== undefined, '应包含 stats');
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-002 缺少 --task-spec
test('TC-FILTER-002 缺少 --task-spec 应报错', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
    ]);
    assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
    const output = r.stderr + r.stdout;
    assert.ok(
      output.includes('task-spec') || output.includes('task_spec') || output.includes('必须'),
      `错误信息应提及 task-spec，实际: ${output}`
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-003 输入文件不存在
test('TC-FILTER-003 输入文件不存在应报错', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', '/nonexistent/path/comments.json',
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
    const output = r.stderr + r.stdout;
    assert.ok(
      output.includes('不存在') || output.includes('存在') || output.includes('not found') ||
      output.includes('ENOENT') || output.includes('找不到'),
      `错误信息应提及文件不存在，实际: ${output}`
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-004a 纯表情评论被过滤
test('TC-FILTER-004a 纯表情评论应被过滤', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    // 确认纯表情评论（😍😍😍）不在 posts 的任何 comments 中
    const allComments = obj.posts.flatMap(p => p.comments || []);
    const emojiComment = allComments.find(c => c.username === 'user_emoji_001');
    assert.ok(!emojiComment, '纯表情评论（user_emoji_001）不应进入 posts');
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-004b 广告引流被过滤
test('TC-FILTER-004b 广告引流评论应被过滤', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    const allComments = obj.posts.flatMap(p => p.comments || []);
    const adComment = allComments.find(c => c.username === 'user_ad_001');
    assert.ok(!adComment, '广告引流评论（user_ad_001）不应进入 posts');
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-004c 作者自回复被过滤
test('TC-FILTER-004c 作者自回复应被过滤', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    const allComments = obj.posts.flatMap(p => p.comments || []);
    const authorComment = allComments.find(c => c.username === 'test_author_001');
    assert.ok(!authorComment, '作者自回复（test_author_001）不应进入 posts');
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-004d 纯@引用被过滤
test('TC-FILTER-004d 纯@引用应被过滤', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    const allComments = obj.posts.flatMap(p => p.comments || []);
    const mentionComment = allComments.find(c => c.username === 'user_mention_001');
    assert.ok(!mentionComment, '纯@引用（user_mention_001）不应进入 posts');
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-005a 帖子同时命中 include 和 exclude 时保留
test('TC-FILTER-005a 标题同时命中 include 和 exclude 的帖子应保留', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    const keptTitles = obj.posts.map(p => p.title || '');
    const keptMixedSignalPost = keptTitles.some(t => t === '避雷！某医美机构');
    assert.ok(
      keptMixedSignalPost,
      `同时命中 include/exclude 的帖子应保留，当前 posts titles: ${keptTitles.join(',')}`
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-FILTER-005b 纯 exclude 帖子进入 skippedPosts
test('TC-FILTER-005b 仅命中 exclude 的帖子应进入 skippedPosts', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));

    const skippedTitles = obj.skippedPosts.map(p => p.title || '');
    const hasSkipped = skippedTitles.some(t => t === '避雷！某护肤店');
    assert.ok(
      hasSkipped,
      `仅命中 exclude 的帖子应在 skippedPosts，当前 skippedPosts titles: ${skippedTitles.join(',')}`
    );
  } finally {
    cleanAll(KW);
  }
});

// stats 字段完整性
test('stats 字段应完整', () => {
  setupFixtures();
  try {
    const r = runScript('filter-comments.js', [
      '--input', COMMENTS_FILE,
      '--output', CANDIDATES_FILE,
      '--task-spec', TASK_SPEC_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
    const s = obj.stats;
    assert.ok(s !== undefined, 'stats 应存在');
    ['totalPosts', 'keptPosts', 'totalComments', 'filteredComments', 'keptComments'].forEach(field => {
      assert.ok(s[field] !== undefined, `stats.${field} 应存在`);
    });
  } finally {
    cleanAll(KW);
  }
});

// ─── 后置清理 ─────────────────────────────────────────────────────────────────
cleanAll(KW);

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
