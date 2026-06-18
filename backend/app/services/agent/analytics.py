"""
Analytics Service
Provides file statistics, activity tracking, and dashboard analytics.
"""
import logging
from typing import Dict, Any, List
from uuid import UUID
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Analytics and statistics service"""
    
    def __init__(self, supabase_client):
        self.db = supabase_client
    
    async def get_dashboard_analytics(
        self,
        user_id: UUID,
        period: str = '7d'
    ) -> Dict[str, Any]:
        """
        Get comprehensive dashboard analytics.
        
        Args:
            user_id: User UUID
            period: Time period ('24h', '7d', '30d', '90d', '1y', 'all')
            
        Returns:
            Complete analytics dashboard data
        """
        try:
            # Calculate date range
            start_date = self._get_start_date(period)
            
            # Gather all analytics in parallel
            file_stats = await self._get_file_stats(user_id, start_date)
            activity_stats = await self._get_activity_stats(user_id, start_date)
            top_files = await self._get_top_files(user_id, start_date)
            storage_breakdown = await self._get_storage_breakdown(user_id)
            
            return {
                'file_stats': file_stats,
                'activity_stats': activity_stats,
                'top_files': top_files,
                'storage_breakdown': storage_breakdown,
                'period': period,
                'generated_at': datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Dashboard analytics error: {str(e)}")
            return self._get_empty_analytics(period)
    
    async def _get_file_stats(
        self,
        user_id: UUID,
        start_date: datetime
    ) -> Dict[str, Any]:
        """Get file statistics"""
        try:
            # Get all files for user
            response = self.db.table('file_metadata') \
                .select('id, mime_type, size_bytes, drive_id, created_at') \
                .eq('user_id', str(user_id)) \
                .gte('created_at', start_date.isoformat()) \
                .execute()
            
            files = response.data
            
            # Calculate stats
            total_files = len(files)
            total_size = sum(f.get('size_bytes', 0) or 0 for f in files)
            
            # Group by type
            by_type = defaultdict(int)
            for f in files:
                mime = f.get('mime_type', 'unknown')
                category = self._categorize_mime_type(mime)
                by_type[category] += 1
            
            # Group by drive
            by_drive = defaultdict(int)
            for f in files:
                drive_id = f.get('drive_id', 'unknown')
                by_drive[drive_id] += 1
            
            return {
                'total_files': total_files,
                'total_size': total_size,
                'total_size_readable': self._format_size(total_size),
                'by_type': dict(by_type),
                'by_drive': dict(by_drive),
                'average_file_size': total_size // total_files if total_files > 0 else 0
            }
        
        except Exception as e:
            logger.error(f"File stats error: {str(e)}")
            return {
                'total_files': 0,
                'total_size': 0,
                'by_type': {},
                'by_drive': {},
                'average_file_size': 0
            }
    
    async def _get_activity_stats(
        self,
        user_id: UUID,
        start_date: datetime
    ) -> Dict[str, Any]:
        """Get activity statistics"""
        try:
            # Get activity logs
            response = self.db.table('activity_logs') \
                .select('action_type, created_at') \
                .eq('user_id', str(user_id)) \
                .gte('created_at', start_date.isoformat()) \
                .execute()
            
            activities = response.data
            
            # Count by action type
            action_counts = defaultdict(int)
            for activity in activities:
                action_counts[activity['action_type']] += 1
            
            # Create timeline (group by day)
            timeline = self._create_timeline(activities, start_date)
            
            return {
                'total_actions': len(activities),
                'uploads': action_counts.get('upload', 0),
                'downloads': action_counts.get('download', 0),
                'views': action_counts.get('view', 0),
                'shares': action_counts.get('share', 0),
                'deletes': action_counts.get('delete', 0),
                'timeline': timeline
            }
        
        except Exception as e:
            logger.error(f"Activity stats error: {str(e)}")
            return {
                'total_actions': 0,
                'uploads': 0,
                'downloads': 0,
                'views': 0,
                'shares': 0,
                'deletes': 0,
                'timeline': []
            }
    
    async def _get_top_files(
        self,
        user_id: UUID,
        start_date: datetime
    ) -> Dict[str, List[Dict]]:
        """Get top files by various criteria"""
        try:
            # Most viewed files
            most_viewed = await self._get_most_viewed_files(user_id, start_date)
            
            # Recently added files
            recently_added = await self._get_recently_added_files(user_id, start_date)
            
            # Largest files
            largest_files = await self._get_largest_files(user_id)
            
            return {
                'most_viewed': most_viewed,
                'recently_added': recently_added,
                'largest_files': largest_files
            }
        
        except Exception as e:
            logger.error(f"Top files error: {str(e)}")
            return {
                'most_viewed': [],
                'recently_added': [],
                'largest_files': []
            }
    
    async def _get_most_viewed_files(
        self,
        user_id: UUID,
        start_date: datetime,
        limit: int = 10
    ) -> List[Dict]:
        """Get most viewed files based on activity logs"""
        try:
            # Use activity_logs table for view tracking
            response = self.db.table('activity_logs') \
                .select('target_id, action_type') \
                .eq('user_id', str(user_id)) \
                .eq('action_type', 'view') \
                .eq('target_type', 'file') \
                .gte('created_at', start_date.isoformat()) \
                .execute()
            
            # Count views per file
            file_views = defaultdict(int)
            for log in response.data:
                if log.get('target_id'):
                    file_views[log['target_id']] += 1
            
            # Sort by view count
            sorted_files = sorted(
                file_views.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]
            
            results = []
            for file_id, view_count in sorted_files:
                try:
                    meta = self.db.table('file_metadata') \
                        .select('id, display_name, size_bytes, mime_type') \
                        .eq('id', file_id) \
                        .single() \
                        .execute()
                    if meta.data:
                        results.append({
                            'file_id': file_id,
                            'filename': meta.data.get('display_name', 'Unknown'),
                            'view_count': view_count,
                            'size': meta.data.get('size_bytes', 0),
                            'mime_type': meta.data.get('mime_type', 'unknown')
                        })
                except Exception:
                    pass
            
            return results
        
        except Exception as e:
            logger.error(f"Most viewed files error: {str(e)}")
            return []
    
    async def _get_recently_added_files(
        self,
        user_id: UUID,
        start_date: datetime,
        limit: int = 10
    ) -> List[Dict]:
        """Get recently added files"""
        try:
            response = self.db.table('file_metadata') \
                .select('id, display_name, size_bytes, mime_type, created_at') \
                .eq('user_id', str(user_id)) \
                .gte('created_at', start_date.isoformat()) \
                .order('created_at', desc=True) \
                .limit(limit) \
                .execute()
            
            return [{
                'file_id': f['id'],
                'filename': f.get('display_name', 'Unknown'),
                'size': f.get('size_bytes', 0),
                'mime_type': f.get('mime_type', 'unknown'),
                'created_at': f.get('created_at')
            } for f in response.data]
        
        except Exception as e:
            logger.error(f"Recently added files error: {str(e)}")
            return []
    
    async def _get_largest_files(
        self,
        user_id: UUID,
        limit: int = 10
    ) -> List[Dict]:
        """Get largest files"""
        try:
            response = self.db.table('file_metadata') \
                .select('id, display_name, size_bytes, mime_type, created_at') \
                .eq('user_id', str(user_id)) \
                .order('size_bytes', desc=True) \
                .limit(limit) \
                .execute()
            
            return [{
                'file_id': f['id'],
                'filename': f.get('display_name', 'Unknown'),
                'size': f.get('size_bytes', 0),
                'mime_type': f.get('mime_type', 'unknown'),
                'created_at': f.get('created_at')
            } for f in response.data]
        
        except Exception as e:
            logger.error(f"Largest files error: {str(e)}")
            return []
    
    async def _get_storage_breakdown(self, user_id: UUID) -> Dict[str, Any]:
        """Get storage breakdown by drive"""
        try:
            # Get all drives
            drives = self.db.table('google_drive_tokens') \
                .select('id, drive_email, drive_quota_total, drive_quota_used') \
                .eq('user_id', str(user_id)) \
                .execute()
            
            breakdown = []
            for drive in drives.data:
                # Get files for this drive
                files = self.db.table('file_metadata') \
                    .select('size_bytes') \
                    .eq('drive_id', drive['id']) \
                    .execute()
                
                used = sum(f.get('size_bytes', 0) or 0 for f in files.data)
                allocated = drive.get('drive_quota_total', 0) or 0
                
                breakdown.append({
                    'drive_id': drive['id'],
                    'drive_name': drive.get('drive_email', 'Drive'),
                    'used': used,
                    'allocated': allocated,
                    'percentage': (used / allocated * 100) if allocated > 0 else 0
                })
            
            return {
                'drives': breakdown,
                'total_used': sum(d['used'] for d in breakdown),
                'total_allocated': sum(d['allocated'] for d in breakdown)
            }
        
        except Exception as e:
            logger.error(f"Storage breakdown error: {str(e)}")
            return {
                'drives': [],
                'total_used': 0,
                'total_allocated': 0
            }
    
    def _create_timeline(
        self,
        activities: List[Dict],
        start_date: datetime
    ) -> List[Dict[str, Any]]:
        """Create activity timeline grouped by day"""
        timeline = defaultdict(int)
        
        for activity in activities:
            date = datetime.fromisoformat(activity['created_at'].replace('Z', '+00:00'))
            day_key = date.strftime('%Y-%m-%d')
            timeline[day_key] += 1
        
        # Convert to list and sort
        result = [
            {'date': date, 'count': count}
            for date, count in sorted(timeline.items())
        ]
        
        return result
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """Format byte size to human-readable string"""
        if size_bytes >= 1024**3:
            return f"{size_bytes / 1024**3:.1f} GB"
        elif size_bytes >= 1024**2:
            return f"{size_bytes / 1024**2:.1f} MB"
        elif size_bytes >= 1024:
            return f"{size_bytes / 1024:.1f} KB"
        return f"{size_bytes} B"

    def _categorize_mime_type(self, mime_type: str) -> str:
        """Categorize MIME type into general category"""
        if not mime_type:
            return 'other'
        
        mime_lower = mime_type.lower()
        
        if 'pdf' in mime_lower:
            return 'pdf'
        elif 'image' in mime_lower:
            return 'image'
        elif 'video' in mime_lower:
            return 'video'
        elif 'audio' in mime_lower:
            return 'audio'
        elif any(x in mime_lower for x in ['word', 'document', 'msword']):
            return 'document'
        elif any(x in mime_lower for x in ['excel', 'spreadsheet']):
            return 'spreadsheet'
        elif any(x in mime_lower for x in ['powerpoint', 'presentation']):
            return 'presentation'
        elif 'text' in mime_lower:
            return 'text'
        elif 'zip' in mime_lower or 'compressed' in mime_lower:
            return 'archive'
        else:
            return 'other'
    
    def _get_start_date(self, period: str) -> datetime:
        """Calculate start date based on period"""
        now = datetime.utcnow()
        
        if period == '24h':
            return now - timedelta(hours=24)
        elif period == '7d':
            return now - timedelta(days=7)
        elif period == '30d':
            return now - timedelta(days=30)
        elif period == '90d':
            return now - timedelta(days=90)
        elif period == '1y':
            return now - timedelta(days=365)
        else:  # 'all'
            return datetime(2000, 1, 1)  # Beginning of time
    
    def _get_empty_analytics(self, period: str) -> Dict[str, Any]:
        """Return empty analytics structure"""
        return {
            'file_stats': {
                'total_files': 0,
                'total_size': 0,
                'by_type': {},
                'by_drive': {},
                'average_file_size': 0
            },
            'activity_stats': {
                'total_actions': 0,
                'uploads': 0,
                'downloads': 0,
                'views': 0,
                'shares': 0,
                'deletes': 0,
                'timeline': []
            },
            'top_files': {
                'most_viewed': [],
                'recently_added': [],
                'largest_files': []
            },
            'storage_breakdown': {
                'drives': [],
                'total_used': 0,
                'total_allocated': 0
            },
            'period': period,
            'generated_at': datetime.utcnow().isoformat()
        }


# Factory function
def create_analytics_service(supabase_client):
    return AnalyticsService(supabase_client)
