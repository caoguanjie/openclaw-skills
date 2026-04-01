'use strict';

/**
 * 合法 task spec 对象
 */
function makeTaskSpec(keyword, overrides = {}) {
  return {
    keyword,
    post_relevance: {
      include: ['医美', '热玛吉'],
      exclude: ['避雷', '翻车'],
    },
    comment_filter: {
      include: ['多少钱', '想做', '求推荐'],
      exclude: ['我是做', '加我', '合作'],
    },
    semantic_focus: '只保留明确购买意向用户',
    ...overrides,
  };
}

/**
 * 模拟 xhs-scraper.js 输出的 comments JSON
 * @param {string} keyword
 * @param {object[]} posts - 帖子数组，每项可含 author/title/url/comments
 */
function makeComments(keyword, posts) {
  const defaultPosts = posts || [
    {
      title: `${keyword}体验分享`,
      url: 'https://www.xiaohongshu.com/explore/aaaaaa000000000001',
      noteId: 'aaaaaa000000000001',
      author: 'test_author_001',
      commentCount: '5',
      comments: [
        {
          username: 'user_want_001',
          userId: 'uid_want_001',
          content: '多少钱啊，我也想做',
          ipLocation: '上海',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '2',
        },
        {
          username: 'user_emoji_001',
          userId: 'uid_emoji_001',
          content: '😍😍😍',
          ipLocation: '北京',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_emoji_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '0',
        },
        {
          username: 'user_ad_001',
          userId: 'uid_ad_001',
          content: '需要的加我微信，我是做医美的',
          ipLocation: '广州',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_ad_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '0',
        },
        {
          username: 'test_author_001', // 作者自回复
          userId: 'uid_author_001',
          content: '谢谢大家支持',
          ipLocation: '上海',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_author_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '0',
        },
        {
          username: 'user_mention_001',
          userId: 'uid_mention_001',
          content: '@test_author_001 ',
          ipLocation: '深圳',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_mention_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '0',
        },
      ],
    },
    {
      title: '避雷！某医美机构',
      url: 'https://www.xiaohongshu.com/explore/bbbbbb000000000002',
      noteId: 'bbbbbb000000000002',
      author: 'test_author_002',
      commentCount: '2',
      comments: [
        {
          username: 'user_normal_001',
          userId: 'uid_normal_001',
          content: '这家真的太坑了',
          ipLocation: '北京',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_normal_001',
          isSubComment: false,
          subCommentCount: '0',
          likes: '5',
        },
      ],
    },
    {
      title: '避雷！这家机构彻底翻车了',
      url: 'https://www.xiaohongshu.com/explore/eeeeee000000000005',
      noteId: 'eeeeee000000000005',
      author: 'test_author_003',
      commentCount: '1',
      comments: [
        {
          username: 'user_normal_002',
          userId: 'uid_normal_002',
          content: '太坑了，大家别去',
          ipLocation: '杭州',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_normal_002',
          isSubComment: false,
          subCommentCount: '0',
          likes: '3',
        },
      ],
    },
  ];

  return {
    keyword,
    scrapeTime: new Date().toISOString(),
    posts: defaultPosts,
  };
}

/**
 * 模拟 filter-comments.js 输出的 candidates JSON
 */
function makeCandidates(keyword, taskSpecPath, taskSpec, posts) {
  const defaultPosts = posts || [
    {
      title: `${keyword}体验分享`,
      url: 'https://www.xiaohongshu.com/explore/aaaaaa000000000001',
      noteId: 'aaaaaa000000000001',
      taskSpecSignals: ['医美'],
      comments: [
        {
          username: 'user_want_001',
          userId: 'uid_want_001',
          content: '多少钱啊，我也想做',
          ipLocation: '上海',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_001',
          matchedSignals: ['多少钱', '想做'],
          candidateReason: '命中粗筛词: 多少钱',
        },
      ],
    },
    {
      title: `${keyword}进阶指南`,
      url: 'https://www.xiaohongshu.com/explore/cccccc000000000003',
      noteId: 'cccccc000000000003',
      taskSpecSignals: ['医美'],
      comments: [
        {
          username: 'user_want_002',
          userId: 'uid_want_002',
          content: '求推荐靠谱的医美机构',
          ipLocation: '深圳',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_002',
          matchedSignals: ['求推荐'],
          candidateReason: '命中粗筛词: 求推荐',
        },
      ],
    },
    {
      title: `${keyword}避坑指南`,
      url: 'https://www.xiaohongshu.com/explore/dddddd000000000004',
      noteId: 'dddddd000000000004',
      taskSpecSignals: ['医美'],
      comments: [
        {
          username: 'user_want_003',
          userId: 'uid_want_003',
          content: '想做热玛吉，有没有好的推荐',
          ipLocation: '成都',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_003',
          matchedSignals: ['想做'],
          candidateReason: '命中粗筛词: 想做',
        },
      ],
    },
  ];

  return {
    keyword,
    taskSpecPath,
    taskSpec: taskSpec || makeTaskSpec(keyword),
    posts: defaultPosts,
    skippedPosts: [],
    stats: {
      totalPosts: 3,
      keptPosts: 3,
      totalComments: 10,
      filteredComments: 5,
      keptComments: 3,
      filterReasons: {},
    },
  };
}

/**
 * 模拟 sub-agent 输出的单帖分析分片（analysis_posts/<kw>/<noteId>.json）
 */
function makeAnalysisShard(noteId, title, url, validComments) {
  const defaultComments = validComments || [
    {
      username: 'user_want_001',
      userId: 'uid_want_001',
      content: '多少钱啊，我也想做',
      ipLocation: '上海',
      interestTags: '购买意向, 咨询',
      interestScore: 8,
      reason: '明确表达想做医美，询问价格',
      profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_001',
    },
  ];

  return {
    postId: noteId,
    title: title || '医美体验分享',
    url: url || `https://www.xiaohongshu.com/explore/${noteId}`,
    screenshotFile: null,
    totalComments: 10,
    collectedComments: 5,
    validComments: defaultComments,
  };
}

/**
 * 模拟 merge-analysis.js 输出 / generate-excel.js 输入的 analysis JSON
 */
function makeAnalysis(keyword, posts) {
  const defaultPosts = posts || [
    {
      title: `${keyword}体验分享`,
      url: 'https://www.xiaohongshu.com/explore/aaaaaa000000000001',
      screenshotFile: null,
      totalComments: 10,
      collectedComments: 5,
      validComments: [
        {
          username: 'user_want_001',
          userId: 'uid_want_001',
          content: '多少钱啊，我也想做',
          ipLocation: '上海',
          interestTags: '购买意向, 咨询',
          interestScore: 8,
          reason: '明确表达想做医美，询问价格',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_001',
        },
        {
          username: 'user_want_001', // 同一用户第二条评论（用于测试合并）
          userId: 'uid_want_001',
          content: '上次做了热玛吉效果很好',
          ipLocation: '上海',
          interestTags: '购买意向',
          interestScore: 9,
          reason: '有使用经验且评价正面',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_001',
        },
        {
          username: 'user_want_002',
          userId: 'uid_want_002',
          content: '求推荐靠谱的医美机构',
          ipLocation: '深圳',
          interestTags: '购买意向',
          interestScore: 7,
          reason: '主动寻求推荐，意向明确',
          profileUrl: 'https://www.xiaohongshu.com/user/profile/uid_want_002',
        },
      ],
    },
  ];

  return { keyword, posts: defaultPosts };
}

module.exports = {
  makeTaskSpec,
  makeComments,
  makeCandidates,
  makeAnalysisShard,
  makeAnalysis,
};
