-- Add receipt_number column to receiving_events table
ALTER TABLE receiving_events ADD COLUMN receipt_number INTEGER;

-- Create unique index on receipt_number
CREATE UNIQUE INDEX receiving_events_receipt_number_idx ON receiving_events(receipt_number);

-- For existing records, generate sequential receipt numbers
-- First, create a sequence starting from the count of existing records
DO $$
DECLARE
    max_receipt_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(receipt_number), 0) INTO max_receipt_num FROM receiving_events;
    
    -- Update existing records with sequential numbers starting from max + 1
    UPDATE receiving_events
    SET receipt_number = subquery.new_number
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") + max_receipt_num AS new_number
        FROM receiving_events
        WHERE receipt_number IS NULL
    ) AS subquery
    WHERE receiving_events.id = subquery.id;
END $$;

-- Make receipt_number NOT NULL after populating existing records
ALTER TABLE receiving_events ALTER COLUMN receipt_number SET NOT NULL;


