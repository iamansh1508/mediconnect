function buildPaginationResponse(items, cursor, limit, totalCount) {
  const paginatedItems = Array.isArray(items) ? items : [];
  const normalizedLimit = Number.isFinite(limit) ? limit : paginatedItems.length;

  let nextCursor = null;
  let hasMore = false;

  if (paginatedItems.length > normalizedLimit) {
    hasMore = true;
    const lastItem = paginatedItems[normalizedLimit - 1];
    nextCursor = lastItem && lastItem._id ? String(lastItem._id) : null;
  }

  const resultItems = hasMore ? paginatedItems.slice(0, normalizedLimit) : paginatedItems;

  return {
    items: resultItems,
    pagination: {
      nextCursor,
      hasMore,
      count: resultItems.length,
      total: totalCount,
    },
  };
}

module.exports = {
  buildPaginationResponse,
};
