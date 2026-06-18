/**
 * Text Diff Utility for DocMatrix DMS
 * Advanced text comparison with word-level and character-level diff
 */

// Longest Common Subsequence (LCS) algorithm for better diff accuracy
const computeLCS = (arr1, arr2) => {
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
};

// Backtrack to find LCS elements
const backtrackLCS = (dp, arr1, arr2) => {
  const result = [];
  let i = arr1.length;
  let j = arr2.length;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      result.unshift({ value: arr1[i - 1], index1: i - 1, index2: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
};

// Compute line-level diff using LCS
export const computeLineDiff = (text1, text2) => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  const dp = computeLCS(lines1, lines2);
  const lcs = backtrackLCS(dp, lines1, lines2);
  
  const result = [];
  let idx1 = 0;
  let idx2 = 0;
  let lcsIdx = 0;

  while (idx1 < lines1.length || idx2 < lines2.length) {
    const lcsItem = lcs[lcsIdx];

    if (lcsItem && idx1 === lcsItem.index1 && idx2 === lcsItem.index2) {
      // Unchanged line
      result.push({
        type: 'unchanged',
        lineNum1: idx1 + 1,
        lineNum2: idx2 + 1,
        content: lines1[idx1]
      });
      idx1++;
      idx2++;
      lcsIdx++;
    } else {
      // Check if we need to add removed or added lines
      if (lcsItem) {
        while (idx1 < lcsItem.index1) {
          result.push({
            type: 'removed',
            lineNum1: idx1 + 1,
            lineNum2: null,
            content: lines1[idx1]
          });
          idx1++;
        }
        while (idx2 < lcsItem.index2) {
          result.push({
            type: 'added',
            lineNum1: null,
            lineNum2: idx2 + 1,
            content: lines2[idx2]
          });
          idx2++;
        }
      } else {
        // No more LCS items
        while (idx1 < lines1.length) {
          result.push({
            type: 'removed',
            lineNum1: idx1 + 1,
            lineNum2: null,
            content: lines1[idx1]
          });
          idx1++;
        }
        while (idx2 < lines2.length) {
          result.push({
            type: 'added',
            lineNum1: null,
            lineNum2: idx2 + 1,
            content: lines2[idx2]
          });
          idx2++;
        }
      }
    }
  }

  return result;
};

// Compute unified diff format
export const computeUnifiedDiff = (text1, text2, contextLines = 3) => {
  const lineDiff = computeLineDiff(text1, text2);
  const hunks = [];
  let currentHunk = null;

  for (let i = 0; i < lineDiff.length; i++) {
    const line = lineDiff[i];
    const isChange = line.type !== 'unchanged';

    if (isChange) {
      if (!currentHunk) {
        // Start new hunk with context
        const startIdx = Math.max(0, i - contextLines);
        currentHunk = {
          startLine1: lineDiff[startIdx].lineNum1 || 1,
          startLine2: lineDiff[startIdx].lineNum2 || 1,
          lines: lineDiff.slice(startIdx, i).map(l => ({ ...l }))
        };
      }
      currentHunk.lines.push({ ...line });
    } else if (currentHunk) {
      // Check if we should continue the hunk or close it
      let hasMoreChanges = false;
      for (let j = i + 1; j <= i + contextLines * 2 && j < lineDiff.length; j++) {
        if (lineDiff[j].type !== 'unchanged') {
          hasMoreChanges = true;
          break;
        }
      }

      if (hasMoreChanges) {
        currentHunk.lines.push({ ...line });
      } else {
        // Add trailing context and close hunk
        const endIdx = Math.min(lineDiff.length, i + contextLines);
        for (let j = i; j < endIdx; j++) {
          currentHunk.lines.push({ ...lineDiff[j] });
        }
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
};

// Compute word-level diff
export const computeWordDiff = (text1, text2) => {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  
  const dp = computeLCS(words1, words2);
  const lcs = backtrackLCS(dp, words1, words2);
  
  const result = [];
  let idx1 = 0;
  let idx2 = 0;
  let lcsIdx = 0;

  while (idx1 < words1.length || idx2 < words2.length) {
    const lcsItem = lcs[lcsIdx];

    if (lcsItem && idx1 === lcsItem.index1 && idx2 === lcsItem.index2) {
      result.push({ type: 'unchanged', text: words1[idx1] });
      idx1++;
      idx2++;
      lcsIdx++;
    } else {
      if (lcsItem) {
        while (idx1 < lcsItem.index1) {
          result.push({ type: 'removed', text: words1[idx1] });
          idx1++;
        }
        while (idx2 < lcsItem.index2) {
          result.push({ type: 'added', text: words2[idx2] });
          idx2++;
        }
      } else {
        while (idx1 < words1.length) {
          result.push({ type: 'removed', text: words1[idx1] });
          idx1++;
        }
        while (idx2 < words2.length) {
          result.push({ type: 'added', text: words2[idx2] });
          idx2++;
        }
      }
    }
  }

  return result;
};

// Compute character-level diff for small texts
export const computeCharDiff = (text1, text2) => {
  const chars1 = text1.split('');
  const chars2 = text2.split('');
  
  const dp = computeLCS(chars1, chars2);
  const lcs = backtrackLCS(dp, chars1, chars2);
  
  const result = [];
  let idx1 = 0;
  let idx2 = 0;
  let lcsIdx = 0;

  while (idx1 < chars1.length || idx2 < chars2.length) {
    const lcsItem = lcs[lcsIdx];

    if (lcsItem && idx1 === lcsItem.index1 && idx2 === lcsItem.index2) {
      result.push({ type: 'unchanged', char: chars1[idx1] });
      idx1++;
      idx2++;
      lcsIdx++;
    } else {
      if (lcsItem) {
        while (idx1 < lcsItem.index1) {
          result.push({ type: 'removed', char: chars1[idx1] });
          idx1++;
        }
        while (idx2 < lcsItem.index2) {
          result.push({ type: 'added', char: chars2[idx2] });
          idx2++;
        }
      } else {
        while (idx1 < chars1.length) {
          result.push({ type: 'removed', char: chars1[idx1] });
          idx1++;
        }
        while (idx2 < chars2.length) {
          result.push({ type: 'added', char: chars2[idx2] });
          idx2++;
        }
      }
    }
  }

  return result;
};

// Tokenize text into words (preserving whitespace as separate tokens)
const tokenize = (text) => {
  return text.split(/(\s+)/).filter(Boolean);
};

// Create side-by-side diff view data
export const createSideBySideDiff = (text1, text2) => {
  const lineDiff = computeLineDiff(text1, text2);
  const leftLines = [];
  const rightLines = [];

  let leftLineNum = 0;
  let rightLineNum = 0;

  for (const item of lineDiff) {
    if (item.type === 'unchanged') {
      leftLineNum++;
      rightLineNum++;
      leftLines.push({
        lineNum: leftLineNum,
        content: item.content,
        type: 'unchanged'
      });
      rightLines.push({
        lineNum: rightLineNum,
        content: item.content,
        type: 'unchanged'
      });
    } else if (item.type === 'removed') {
      leftLineNum++;
      leftLines.push({
        lineNum: leftLineNum,
        content: item.content,
        type: 'removed'
      });
      rightLines.push({
        lineNum: null,
        content: '',
        type: 'empty'
      });
    } else if (item.type === 'added') {
      rightLineNum++;
      leftLines.push({
        lineNum: null,
        content: '',
        type: 'empty'
      });
      rightLines.push({
        lineNum: rightLineNum,
        content: item.content,
        type: 'added'
      });
    }
  }

  return { leftLines, rightLines };
};

// Calculate diff statistics
export const getDiffStats = (text1, text2) => {
  const lineDiff = computeLineDiff(text1, text2);
  
  const added = lineDiff.filter(l => l.type === 'added').length;
  const removed = lineDiff.filter(l => l.type === 'removed').length;
  const unchanged = lineDiff.filter(l => l.type === 'unchanged').length;
  const total = lineDiff.length;

  const words1 = text1.split(/\s+/).filter(Boolean).length;
  const words2 = text2.split(/\s+/).filter(Boolean).length;

  const chars1 = text1.length;
  const chars2 = text2.length;

  return {
    lines: { added, removed, unchanged, total },
    words: { before: words1, after: words2, diff: words2 - words1 },
    chars: { before: chars1, after: chars2, diff: chars2 - chars1 },
    similarity: unchanged / total * 100 || 0
  };
};

// Highlight inline changes in a line
export const highlightLineChanges = (line1, line2) => {
  const wordDiff = computeWordDiff(line1, line2);
  
  return {
    left: wordDiff
      .filter(w => w.type === 'unchanged' || w.type === 'removed')
      .map(w => ({ text: w.text, highlighted: w.type === 'removed' })),
    right: wordDiff
      .filter(w => w.type === 'unchanged' || w.type === 'added')
      .map(w => ({ text: w.text, highlighted: w.type === 'added' }))
  };
};

// Create inline diff (single column with +/- markers)
export const createInlineDiff = (text1, text2) => {
  const lineDiff = computeLineDiff(text1, text2);
  
  return lineDiff.map(item => ({
    ...item,
    marker: item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' '
  }));
};

// Find modified line pairs (for inline word highlighting)
export const findModifiedPairs = (text1, text2) => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const pairs = [];

  const lineDiff = computeLineDiff(text1, text2);
  
  let i = 0;
  while (i < lineDiff.length) {
    if (lineDiff[i].type === 'removed') {
      // Look for potential matching added line
      const removedLines = [];
      let j = i;
      while (j < lineDiff.length && lineDiff[j].type === 'removed') {
        removedLines.push(lineDiff[j]);
        j++;
      }
      
      const addedLines = [];
      while (j < lineDiff.length && lineDiff[j].type === 'added') {
        addedLines.push(lineDiff[j]);
        j++;
      }

      // Pair up removed and added lines
      const maxPairs = Math.max(removedLines.length, addedLines.length);
      for (let k = 0; k < maxPairs; k++) {
        pairs.push({
          removed: removedLines[k] || null,
          added: addedLines[k] || null,
          wordDiff: removedLines[k] && addedLines[k] 
            ? computeWordDiff(removedLines[k].content, addedLines[k].content)
            : null
        });
      }

      i = j;
    } else {
      i++;
    }
  }

  return pairs;
};

export default {
  computeLineDiff,
  computeUnifiedDiff,
  computeWordDiff,
  computeCharDiff,
  createSideBySideDiff,
  getDiffStats,
  highlightLineChanges,
  createInlineDiff,
  findModifiedPairs
};
