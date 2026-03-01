-- First, seed primary locations for users who don't have one
-- Assign the first available location (or create a default one if none exists)

-- Step 1: Create a default location if no locations exist
DO $$
DECLARE
  default_location_id UUID;
  location_count INTEGER;
BEGIN
  -- Check if any locations exist
  SELECT COUNT(*) INTO location_count FROM locations WHERE status = 'active';
  
  IF location_count = 0 THEN
    -- Create default location
    INSERT INTO locations (id, name, code, status, is_system, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Default Location',
      'DEFAULT',
      'active',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO default_location_id;
  ELSE
    -- Get the first active location
    SELECT id INTO default_location_id
    FROM locations
    WHERE status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  -- Step 2: Update all users without primary_location_id
  UPDATE users
  SET primary_location_id = default_location_id
  WHERE primary_location_id IS NULL
    AND deleted_at IS NULL;
END $$;

-- Step 3: Make primary_location_id required (non-nullable)
ALTER TABLE users
  ALTER COLUMN primary_location_id SET NOT NULL;
