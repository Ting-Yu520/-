// utils/pagination.js
class Pagination {
  constructor(collectionName, options = {}) {
    this.collectionName = collectionName;
    this.pageSize = options.pageSize || 20;
    this.currentPage = 0;
    this.hasMore = true;
    this.isLoading = false;
    this.whereCondition = options.whereCondition || {};
    this.orderBy = options.orderBy || { field: 'created_at', sort: 'desc' };
  }

  // 加载下一页数据
  async loadNextPage() {
    if (this.isLoading || !this.hasMore) {
      return [];
    }

    this.isLoading = true;
    
    try {
      const db = wx.cloud.database();
      const skipCount = this.currentPage * this.pageSize;
      
      let query = db.collection(this.collectionName)
        .where(this.whereCondition)
        .skip(skipCount)
        .limit(this.pageSize);

      // 添加排序
      if (this.orderBy) {
        query = query.orderBy(this.orderBy.field, this.orderBy.sort);
      }

      const result = await query.get();
      
      this.currentPage++;
      this.hasMore = result.data.length === this.pageSize;
      
      console.log(`分页加载: ${this.collectionName}, 第${this.currentPage}页, 数据量: ${result.data.length}, 还有更多: ${this.hasMore}`);
      
      return result.data;
    } catch (error) {
      console.error('分页加载失败:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  // 重置分页状态
  reset(whereCondition = null) {
    this.currentPage = 0;
    this.hasMore = true;
    this.isLoading = false;
    
    if (whereCondition) {
      this.whereCondition = whereCondition;
    }
    
    console.log(`分页重置: ${this.collectionName}`);
  }

  // 获取当前状态
  getStatus() {
    return {
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      hasMore: this.hasMore,
      isLoading: this.isLoading
    };
  }
}

// 确保正确导出
module.exports = Pagination;