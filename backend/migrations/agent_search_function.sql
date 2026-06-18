-- =====================================================
-- Full-text search function for file content
-- Used by the agent search engine
-- =====================================================

CREATE OR REPLACE FUNCTION search_file_content(
    search_query TEXT,
    p_user_id UUID,
    result_limit INT DEFAULT 20
)
RETURNS TABLE (
    file_id UUID,
    filename TEXT,
    rank REAL,
    snippet TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fet.file_id,
        fm.display_name::TEXT as filename,
        ts_rank(fet.tsv, plainto_tsquery('english', search_query)) as rank,
        ts_headline('english', LEFT(fet.text, 1000), plainto_tsquery('english', search_query), 
            'MaxWords=50, MinWords=20, StartSel=**, StopSel=**') as snippet
    FROM file_extracted_text fet
    JOIN file_metadata fm ON fm.id = fet.file_id
    WHERE fm.user_id = p_user_id
      AND fet.tsv @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
