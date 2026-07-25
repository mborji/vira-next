-- SQL Server Database Schema
-- Run this script once to create all required tables

-- Create database (uncomment if needed)
-- CREATE DATABASE YourAppDatabase;
-- USE YourAppDatabase;

-- Profiles table (user management)
CREATE TABLE profiles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
    email NVARCHAR(255),
    full_name NVARCHAR(255),
    role NVARCHAR(50) NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'super_admin', 'client', 'worker')),
    worker_type NVARCHAR(20) NOT NULL DEFAULT 'full_time' CHECK (worker_type IN ('full_time', 'part_time')),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Users table for authentication
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Blogs table
CREATE TABLE blogs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    author_id UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(500) NOT NULL,
    content NTEXT NOT NULL,
    excerpt NVARCHAR(1000),
    slug NVARCHAR(500) NOT NULL UNIQUE,
    featured_image_url NVARCHAR(1000),
    published BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Contact submissions table
CREATE TABLE contact_submissions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NULL,
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) NOT NULL,
    phone NVARCHAR(50),
    subject NVARCHAR(500) NOT NULL,
    message NTEXT NOT NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
    admin_notes NTEXT,
    reviewed_by UNIQUEIDENTIFIER,
    reviewed_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Ticket responses table
CREATE TABLE ticket_responses (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    submission_id UNIQUEIDENTIFIER NOT NULL,
    message NTEXT NOT NULL,
    is_admin_response BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (submission_id) REFERENCES contact_submissions(id)
);

-- Time logs table
CREATE TABLE time_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    worker_id UNIQUEIDENTIFIER NOT NULL,
    date DATE NOT NULL,
    hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
    description NTEXT,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (worker_id) REFERENCES users(id)
);

-- Day off requests table
CREATE TABLE day_off_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    worker_id UNIQUEIDENTIFIER NOT NULL,
    request_date DATE NOT NULL,
    reason NTEXT,
    status NVARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes NTEXT,
    reviewed_by UNIQUEIDENTIFIER,
    reviewed_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (worker_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Holidays table (company-wide holidays managed by admin)
CREATE TABLE holidays (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    holiday_date DATE NOT NULL UNIQUE,
    title NVARCHAR(255),
    created_by UNIQUEIDENTIFIER,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IX_profiles_user_id ON profiles(user_id);
CREATE INDEX IX_profiles_role ON profiles(role);
CREATE INDEX IX_blogs_author_id ON blogs(author_id);
CREATE INDEX IX_blogs_published ON blogs(published);
CREATE INDEX IX_blogs_slug ON blogs(slug);
CREATE INDEX IX_contact_submissions_user_id ON contact_submissions(user_id);
CREATE INDEX IX_contact_submissions_status ON contact_submissions(status);
CREATE INDEX IX_ticket_responses_submission_id ON ticket_responses(submission_id);
CREATE INDEX IX_time_logs_worker_id ON time_logs(worker_id);
CREATE INDEX IX_time_logs_date ON time_logs(date);
CREATE INDEX IX_day_off_requests_worker_id ON day_off_requests(worker_id);
CREATE INDEX IX_day_off_requests_status ON day_off_requests(status);
CREATE INDEX IX_holidays_holiday_date ON holidays(holiday_date);

-- Create triggers for updated_at columns
CREATE TRIGGER tr_profiles_updated_at
ON profiles
AFTER UPDATE
AS
BEGIN
    UPDATE profiles 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_users_updated_at
ON users
AFTER UPDATE
AS
BEGIN
    UPDATE users 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_blogs_updated_at
ON blogs
AFTER UPDATE
AS
BEGIN
    UPDATE blogs 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_contact_submissions_updated_at
ON contact_submissions
AFTER UPDATE
AS
BEGIN
    UPDATE contact_submissions 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_ticket_responses_updated_at
ON ticket_responses
AFTER UPDATE
AS
BEGIN
    UPDATE ticket_responses 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_time_logs_updated_at
ON time_logs
AFTER UPDATE
AS
BEGIN
    UPDATE time_logs 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_day_off_requests_updated_at
ON day_off_requests
AFTER UPDATE
AS
BEGIN
    UPDATE day_off_requests 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;

CREATE TRIGGER tr_holidays_updated_at
ON holidays
AFTER UPDATE
AS
BEGIN
    UPDATE holidays
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM inserted);
END;