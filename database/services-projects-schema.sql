-- Services table
CREATE TABLE services (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(500) NOT NULL,
    description NTEXT NOT NULL,
    icon NVARCHAR(100) NOT NULL,
    features NTEXT, -- JSON array stored as text
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Projects table
CREATE TABLE projects (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(500) NOT NULL,
    description NTEXT NOT NULL,
    image NVARCHAR(1000),
    category NVARCHAR(200) NOT NULL,
    tags NTEXT, -- JSON array stored as text
    client NVARCHAR(500),
    link NVARCHAR(1000),
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Create indexes
CREATE INDEX IX_services_title ON services(title);
CREATE INDEX IX_projects_category ON projects(category);
CREATE INDEX IX_projects_title ON projects(title);

-- Create triggers for updated_at
CREATE TRIGGER tr_services_updated_at
ON services
AFTER UPDATE
AS
BEGIN
    UPDATE services 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_projects_updated_at
ON projects
AFTER UPDATE
AS
BEGIN
    UPDATE projects 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
