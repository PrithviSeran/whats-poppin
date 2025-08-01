import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

// Types for different operation types
export type APIOperation = 
  | 'insert' 
  | 'update' 
  | 'delete' 
  | 'select' 
  | 'upsert'
  | 'rpc'
  | 'storage_upload'
  | 'storage_delete'
  | 'storage_get_public_url'
  | 'storage_list'
  | 'auth';

export interface QueuedRequest {
  id: string;
  type: APIOperation;
  table?: string;
  data?: any;
  filters?: any;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  optimisticUpdate?: () => void;
  rollback?: () => void;
  batch?: string; // Batch ID for grouping related requests
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  tables: string[];
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number;
  persistToStorage: boolean;
}

class APIRequestService extends EventEmitter {
  private static instance: APIRequestService;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private requestCounter = 0;
  
  // Caching
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private pendingRequests = new Map<string, QueuedRequest>();
  
  // Batching configurations
  private batchConfigs: Map<string, BatchConfig> = new Map([
    ['user_updates', { maxBatchSize: 10, maxWaitTime: 2000, tables: ['all_users'] }],
    ['event_operations', { maxBatchSize: 20, maxWaitTime: 1500, tables: ['new_events', 'user_events'] }],
    ['social_operations', { maxBatchSize: 15, maxWaitTime: 1000, tables: ['follows', 'friends'] }]
  ]);
  
  // Network state tracking
  private isOnline = true;
  private retryDelays = [1000, 2000, 5000, 10000, 30000]; // Progressive backoff
  
  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Minimum 100ms between requests
  
  // Offline queue
  private offlineQueue: QueuedRequest[] = [];
  
  private constructor() {
    super();
    this.initializeNetworkMonitoring();
    this.startQueueProcessor();
    this.loadOfflineQueue();
  }
  
  public static getInstance(): APIRequestService {
    if (!APIRequestService.instance) {
      APIRequestService.instance = new APIRequestService();
    }
    return APIRequestService.instance;
  }
  
  private initializeNetworkMonitoring() {
    // Monitor network connectivity (simplified for this example)
    // In a real app, you'd use @react-native-netinfo/netinfo
    this.isOnline = true;
  }
  
  private async loadOfflineQueue() {
    try {
      const stored = await AsyncStorage.getItem('offline_api_queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.offlineQueue.length} offline requests`);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  }
  
  private async saveOfflineQueue() {
    try {
      await AsyncStorage.setItem('offline_api_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }
  
  /**
   * Queue an API request with optimistic updates
   */
  public async queueRequest<T>(
    operation: APIOperation,
    config: {
      table?: string;
      data?: any;
      filters?: any;
      priority?: 'high' | 'medium' | 'low';
      maxRetries?: number;
      optimisticUpdate?: () => void;
      rollback?: () => void;
      batch?: string;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<T> {
    // Check cache first
    if (config.cacheKey) {
      const cached = this.getFromCache(config.cacheKey);
      if (cached) {
        console.log(`📦 Cache hit for ${config.cacheKey}`);
        return cached;
      }
    }
    
    // Check for pending duplicate requests
    const requestKey = this.generateRequestKey(operation, config);
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${requestKey}`);
      const existingRequest = this.pendingRequests.get(requestKey)!;
      return new Promise((resolve, reject) => {
        // Piggyback on existing request
        const originalResolve = existingRequest.resolve;
        const originalReject = existingRequest.reject;
        
        existingRequest.resolve = (value) => {
          originalResolve(value);
          resolve(value);
        };
        
        existingRequest.reject = (reason) => {
          originalReject(reason);
          reject(reason);
        };
      });
    }
    
    return new Promise<T>((resolve, reject) => {
      const requestId = `req_${++this.requestCounter}_${Date.now()}`;
      
      const queuedRequest: QueuedRequest = {
        id: requestId,
        type: operation,
        table: config.table,
        data: config.data,
        filters: config.filters,
        priority: config.priority || 'medium',
        retryCount: 0,
        maxRetries: config.maxRetries || 3,
        timestamp: Date.now(),
        resolve: (value: T) => {
          this.pendingRequests.delete(requestKey);
          
          // Cache the result if configured
          if (config.cacheKey && value) {
            this.setCache(config.cacheKey, value, config.cacheTTL || 300000); // 5 min default
          }
          
          resolve(value);
        },
        reject: (reason: any) => {
          this.pendingRequests.delete(requestKey);
          
          // Rollback optimistic update if it fails
          if (config.rollback) {
            console.log('🔄 Rolling back optimistic update');
            config.rollback();
          }
          
          reject(reason);
        },
        optimisticUpdate: config.optimisticUpdate,
        rollback: config.rollback,
        batch: config.batch
      };
      
      // Execute optimistic update immediately
      if (config.optimisticUpdate) {
        console.log('⚡ Applying optimistic update');
        config.optimisticUpdate();
        this.emit('optimisticUpdate', { requestId, operation, table: config.table });
      }
      
      // Track pending request
      this.pendingRequests.set(requestKey, queuedRequest);
      
      // Add to appropriate queue
      if (this.isOnline) {
        this.addToQueue(queuedRequest);
      } else {
        this.offlineQueue.push(queuedRequest);
        this.saveOfflineQueue();
        console.log('📱 Added request to offline queue');
      }
    });
  }
  
  private generateRequestKey(operation: APIOperation, config: any): string {
    return `${operation}_${config.table || 'unknown'}_${JSON.stringify(config.filters || {})}_${JSON.stringify(config.data || {})}`;
  }
  
  private addToQueue(request: QueuedRequest) {
    // Priority queue insertion
    const priority = { high: 0, medium: 1, low: 2 }[request.priority];
    
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuePriority = { high: 0, medium: 1, low: 2 }[this.requestQueue[i].priority];
      if (priority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
    console.log(`📋 Queued ${request.type} request (priority: ${request.priority}, queue size: ${this.requestQueue.length})`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  private async startQueueProcessor() {
    // Process queue every 100ms
    setInterval(() => {
      if (!this.isProcessing && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 100);
    
    // Process batches every 500ms
    setInterval(() => {
      this.processBatches();
    }, 500);
  }
  
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0 || !this.isOnline) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }
      
      const request = this.requestQueue.shift()!;
      
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
        this.lastRequestTime = Date.now();
        
        // Small delay between requests to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        await this.handleRequestError(request, error);
      }
    }
    
    this.isProcessing = false;
  }
  
  private async processBatches() {
    // Group requests by batch ID
    const batches = new Map<string, QueuedRequest[]>();
    
    this.requestQueue.forEach((request, index) => {
      if (request.batch) {
        if (!batches.has(request.batch)) {
          batches.set(request.batch, []);
        }
        batches.get(request.batch)!.push(request);
      }
    });
    
    // Process ready batches
    for (const [batchId, requests] of batches) {
      const config = this.batchConfigs.get(batchId);
      if (!config) continue;
      
      const oldestRequest = Math.min(...requests.map(r => r.timestamp));
      const batchAge = Date.now() - oldestRequest;
      
      if (requests.length >= config.maxBatchSize || batchAge >= config.maxWaitTime) {
        console.log(`🔄 Processing batch ${batchId} with ${requests.length} requests`);
        await this.executeBatch(batchId, requests, config);
        
        // Remove processed requests from queue
        this.requestQueue = this.requestQueue.filter(r => !requests.includes(r));
      }
    }
  }
  
  private async executeBatch(batchId: string, requests: QueuedRequest[], config: BatchConfig) {
    try {
      // Group by operation type and table
      const grouped = new Map<string, QueuedRequest[]>();
      
      requests.forEach(request => {
        const key = `${request.type}_${request.table}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(request);
      });
      
      // Execute each group
      for (const [key, groupRequests] of grouped) {
        if (groupRequests[0].type === 'update' && groupRequests[0].table) {
          await this.executeBatchUpdate(groupRequests[0].table, groupRequests);
        } else if (groupRequests[0].type === 'insert' && groupRequests[0].table) {
          await this.executeBatchInsert(groupRequests[0].table, groupRequests);
        } else {
          // Fall back to individual execution
          for (const request of groupRequests) {
            try {
              const result = await this.executeRequest(request);
              request.resolve(result);
            } catch (error) {
              await this.handleRequestError(request, error);
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`Error processing batch ${batchId}:`, error);
      // Fall back to individual processing
      for (const request of requests) {
        this.addToQueue(request);
      }
    }
  }
  
  private async executeBatchUpdate(table: string, requests: QueuedRequest[]) {
    // For updates, we can use Supabase's upsert functionality
    const updates = requests.map(req => ({
      ...req.data,
      ...req.filters
    }));
    
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert(updates, { onConflict: Object.keys(requests[0].filters || {}).join(',') })
        .select();
      
      if (error) throw error;
      
      // Resolve all requests
      requests.forEach((request, index) => {
        request.resolve(data?.[index] || data);
      });
      
      console.log(`✅ Batch update completed for ${requests.length} records in ${table}`);
      
    } catch (error) {
      console.error(`Error in batch update for ${table}:`, error);
      // Fall back to individual requests
      for (const request of requests) {
        this.addToQueue(request);
      }
    }
  }
  
  private async executeBatchInsert(table: string, requests: QueuedRequest[]) {
    const inserts = requests.map(req => req.data);
    
    try {
      const { data, error } = await supabase
        .from(table)
        .insert(inserts)
        .select();
      
      if (error) throw error;
      
      // Resolve all requests
      requests.forEach((request, index) => {
        request.resolve(data?.[index] || data);
      });
      
      console.log(`✅ Batch insert completed for ${requests.length} records in ${table}`);
      
    } catch (error) {
      console.error(`Error in batch insert for ${table}:`, error);
      // Fall back to individual requests
      for (const request of requests) {
        this.addToQueue(request);
      }
    }
  }
  
  private async executeRequest(request: QueuedRequest): Promise<any> {
    console.log(`🚀 Executing ${request.type} request for ${request.table || 'unknown'}`);
    
    switch (request.type) {
      case 'select':
        return this.executeSelect(request);
      case 'insert':
        return this.executeInsert(request);
      case 'update':
        return this.executeUpdate(request);
      case 'delete':
        return this.executeDelete(request);
      case 'upsert':
        return this.executeUpsert(request);
      case 'rpc':
        return this.executeRPC(request);
      case 'storage_upload':
        return this.executeStorageUpload(request);
      case 'storage_delete':
        return this.executeStorageDelete(request);
      case 'storage_get_public_url':
        return this.executeStorageGetPublicUrl(request);
      case 'storage_list':
        return this.executeStorageList(request);
      case 'auth':
        return this.executeAuth(request);
      default:
        throw new Error(`Unknown operation type: ${request.type}`);
    }
  }
  
  private async executeSelect(request: QueuedRequest) {
    if (!request.table) throw new Error('Table required for select operation');
    
    let query = supabase.from(request.table).select(request.data?.select || '*');
    
    // Apply filters
    if (request.filters) {
      Object.entries(request.filters).forEach(([key, value]) => {
        if (key === 'eq') {
          Object.entries(value as any).forEach(([col, val]) => {
            query = query.eq(col, val);
          });
        } else if (key === 'in') {
          Object.entries(value as any).forEach(([col, val]) => {
            query = query.in(col, val as any[]);
          });
        } else if (key === 'not') {
          Object.entries(value as any).forEach(([col, val]) => {
            query = query.not(col, 'eq', val);
          });
        }
        // Add more filter types as needed
      });
    }
    
    // Apply pagination
    if (request.data?.limit) {
      query = query.limit(request.data.limit);
    }
    if (request.data?.offset) {
      query = query.range(request.data.offset, request.data.offset + (request.data.limit || 50) - 1);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data;
  }
  
  private async executeInsert(request: QueuedRequest) {
    if (!request.table || !request.data) {
      throw new Error('Table and data required for insert operation');
    }
    
    const { data, error } = await supabase
      .from(request.table)
      .insert(request.data.values || request.data)
      .select();
    
    if (error) throw error;
    return data;
  }
  
  private async executeUpdate(request: QueuedRequest) {
    if (!request.table || !request.data) {
      throw new Error('Table and data required for update operation');
    }
    
    let query = supabase.from(request.table).update(request.data.values || request.data);
    
    // Apply filters for WHERE clause
    if (request.filters) {
      Object.entries(request.filters).forEach(([key, value]) => {
        if (key === 'eq') {
          Object.entries(value as any).forEach(([col, val]) => {
            query = query.eq(col, val);
          });
        }
        // Add more filter types as needed
      });
    }
    
    const { data, error } = await query.select();
    if (error) throw error;
    
    return data;
  }
  
  private async executeDelete(request: QueuedRequest) {
    if (!request.table) throw new Error('Table required for delete operation');
    
    let query = supabase.from(request.table).delete();
    
    // Apply filters for WHERE clause
    if (request.filters) {
      Object.entries(request.filters).forEach(([key, value]) => {
        if (key === 'eq') {
          Object.entries(value as any).forEach(([col, val]) => {
            query = query.eq(col, val);
          });
        }
        // Add more filter types as needed
      });
    }
    
    const { data, error } = await query.select();
    if (error) throw error;
    
    return data;
  }
  
  private async executeUpsert(request: QueuedRequest) {
    if (!request.table || !request.data) {
      throw new Error('Table and data required for upsert operation');
    }
    
    const { data, error } = await supabase
      .from(request.table)
      .upsert(request.data.values || request.data, request.data.options)
      .select();
    
    if (error) throw error;
    return data;
  }
  
  private async executeRPC(request: QueuedRequest) {
    if (!request.data?.functionName) {
      throw new Error('Function name required for RPC operation');
    }
    
    const { data, error } = await supabase.rpc(
      request.data.functionName,
      request.data.params || {}
    );
    
    if (error) throw error;
    return data;
  }
  
  private async executeStorageUpload(request: QueuedRequest) {
    const { bucket, path, file, options } = request.data;
    
    console.log('📤 executeStorageUpload called with:', { 
      bucket, 
      path, 
      fileType: file instanceof ArrayBuffer ? 'ArrayBuffer' : typeof file,
      fileSize: file?.size || file?.byteLength || 'unknown',
      options 
    });
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options);
    
    if (error) {
      console.error('❌ Storage upload failed:', error);
      throw error;
    }
    
    console.log('✅ Storage upload successful:', data);
    return data;
  }
  
  private async executeStorageDelete(request: QueuedRequest) {
    const { bucket, paths } = request.data;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths);
    
    if (error) throw error;
    return data;
  }

  private async executeStorageGetPublicUrl(request: QueuedRequest) {
    const { bucket, path } = request.data;
    
    console.log('🔗 executeStorageGetPublicUrl called with:', { bucket, path });
    
    try {
      const result = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      console.log('🔗 Storage getPublicUrl result:', JSON.stringify(result, null, 2));
      
      // getPublicUrl doesn't throw errors, but we should validate the result
      if (!result?.data?.publicUrl) {
        console.error('❌ getPublicUrl failed - no publicUrl in result:', result);
        throw new Error(`Failed to generate public URL for ${bucket}/${path}`);
      }
      
      console.log('✅ getPublicUrl successful:', result.data.publicUrl);
      return result; // Return the full result object with { data: { publicUrl } }
    } catch (error) {
      console.error('❌ Error in executeStorageGetPublicUrl:', error);
      throw error;
    }
  }

  private async executeStorageList(request: QueuedRequest) {
    const { bucket, path, options } = request.data;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path, options);
    
    if (error) throw error;
    return data;
  }
  
  private async executeAuth(request: QueuedRequest) {
    const { operation, params } = request.data;
    
    switch (operation) {
      case 'signIn':
        return await supabase.auth.signInWithPassword(params);
      case 'signUp':
        return await supabase.auth.signUp(params);
      case 'signOut':
        return await supabase.auth.signOut();
      case 'getSession':
        return await supabase.auth.getSession();
      case 'getUser':
        return await supabase.auth.getUser();
      case 'updateUser':
        return await supabase.auth.updateUser(params);
      default:
        throw new Error(`Unknown auth operation: ${operation}`);
    }
  }
  
  private async handleRequestError(request: QueuedRequest, error: any) {
    console.error(`❌ Request failed: ${request.type} for ${request.table}`, error);
    
    request.retryCount++;
    
    if (request.retryCount <= request.maxRetries) {
      // Progressive backoff
      const delay = this.retryDelays[Math.min(request.retryCount - 1, this.retryDelays.length - 1)];
      
      console.log(`🔄 Retrying request ${request.id} (attempt ${request.retryCount}/${request.maxRetries}) after ${delay}ms`);
      
      setTimeout(() => {
        this.addToQueue(request);
      }, delay);
      
    } else {
      console.error(`💥 Request ${request.id} failed after ${request.maxRetries} retries`);
      
      // Rollback optimistic update
      if (request.rollback) {
        request.rollback();
      }
      
      request.reject(error);
    }
  }
  
  // Cache management
  private getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  private setCache(key: string, data: any, ttl: number) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
    
    // Cleanup old entries
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      entries.sort(([,a], [,b]) => a.timestamp - b.timestamp);
      // Remove oldest 100 entries
      for (let i = 0; i < 100; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
  
  public clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  // Offline support
  public async syncOfflineQueue() {
    if (!this.isOnline || this.offlineQueue.length === 0) return;
    
    console.log(`🔄 Syncing ${this.offlineQueue.length} offline requests`);
    
    const requests = [...this.offlineQueue];
    this.offlineQueue = [];
    await this.saveOfflineQueue();
    
    // Add all offline requests back to main queue
    requests.forEach(request => {
      this.addToQueue(request);
    });
  }
  
  // Utility methods
  public getQueueSize(): number {
    return this.requestQueue.length;
  }
  
  public getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }
  
  public isPending(requestKey: string): boolean {
    return this.pendingRequests.has(requestKey);
  }
  
  public setOnlineStatus(isOnline: boolean) {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;
    
    if (isOnline && wasOffline) {
      console.log('📶 Connection restored, syncing offline queue');
      this.syncOfflineQueue();
    }
  }
}

export default APIRequestService;