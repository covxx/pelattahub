-- CreateTable: Create system_settings table
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- Insert default settings
INSERT INTO "system_settings" ("key", "value", "description", "updatedAt") VALUES
('company_name', 'Fresh Produce Co.', 'Company name displayed on labels and receipts', NOW()),
('company_address', '123 Growers Ln, Salinas, CA', 'Company address for receipts', NOW()),
('gs1_prefix', '000000', 'GS1 Company Prefix for GTIN validation', NOW()),
('default_case_weight', '40', 'Default case weight in pounds', NOW()),
('label_printer_name', 'Zebra', 'Default label printer name', NOW());


