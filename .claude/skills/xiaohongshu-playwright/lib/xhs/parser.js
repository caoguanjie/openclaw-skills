/**
 * 解析小红书 __INITIAL_STATE__ 中的评论数据
 * @param {Object} noteDetailMap - __INITIAL_STATE__.note.noteDetailMap
 * @param {string} feedId - 帖子 ID
 * @returns {Object} - { note, comments }
 */
function parseStateComments(noteDetailMap, feedId) {
  let noteData = noteDetailMap[feedId];
  if (!noteData) {
    const keys = Object.keys(noteDetailMap);
    if (keys.length > 0) noteData = noteDetailMap[keys[0]];
  }
  if (!noteData) return { note: null, comments: [] };

  const rawNote = noteData.note || {};
  const note = {
    title: rawNote.title || "",
    desc: rawNote.desc || "",
    type: rawNote.type || "",
    ipLocation: rawNote.ipLocation || "",
    author: rawNote.user?.nickname || rawNote.user?.nickName || "",
    authorId: rawNote.user?.userId || "",
    commentCount: rawNote.interactInfo?.commentCount || "0",
    likedCount: rawNote.interactInfo?.likedCount || "0",
    collectedCount: rawNote.interactInfo?.collectedCount || "0",
  };

  const rawComments = noteData.comments?.list || [];
  const comments = [];

  for (const c of rawComments) {
    const userId = c.userInfo?.userId || "";
    comments.push({
      id: c.id || "",
      username: c.userInfo?.nickname || c.userInfo?.nickName || "",
      userId,
      avatar: c.userInfo?.avatar || "",
      content: c.content || "",
      likes: c.likeCount || "0",
      createTime: c.createTime || 0,
      ipLocation: c.ipLocation || "",
      profileUrl: userId
        ? `https://www.xiaohongshu.com/user/profile/${userId}`
        : "",
      subCommentCount: c.subCommentCount || "0",
      subComments: (c.subComments || []).map((sub) => {
        const subUserId = sub.userInfo?.userId || "";
        return {
          id: sub.id || "",
          username: sub.userInfo?.nickname || sub.userInfo?.nickName || "",
          userId: subUserId,
          content: sub.content || "",
          likes: sub.likeCount || "0",
          ipLocation: sub.ipLocation || "",
          profileUrl: subUserId
            ? `https://www.xiaohongshu.com/user/profile/${subUserId}`
            : "",
        };
      }),
    });
  }

  return { note, comments };
}

module.exports = {
  parseStateComments,
};
