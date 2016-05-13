DROP USER IF EXISTS 'quirkboard'@'%';

DROP DATABASE quirkboard;
CREATE DATABASE quirkboard;

USE quirkboard;

CREATE USER 'quirkboard'@'%' IDENTIFIED BY 'quirkpass';
GRANT ALL PRIVILEGES ON quirkboard.* TO 'quirkboard'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

CREATE TABLE boards (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR (16) NOT NULL,
    description VARCHAR (128) NOT NULL
);

INSERT INTO boards (name, description)
VALUES ('/y/', 'Global'), ('/b/', 'Random'), ('/v/', 'Vidya Games'), ('/g/', 'Technology & Programming'), ('/a/', 'Anime & Manga');

CREATE TABLE threads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    boardid INT UNSIGNED NOT NULL,
    created DATETIME NULL DEFAULT NOW(),
    modified DATETIME NULL DEFAULT NOW(),
    points INT NOT NULL DEFAULT 0,
    subject VARCHAR (64) NOT NULL,
    message VARCHAR (1028) NOT NULL,
    filesrc VARCHAR (256) NULL DEFAULT NULL
);

INSERT INTO threads (boardid, points, subject, message, filesrc)
VALUES
(1, 1, 'Welcome to Quirkboard!', 'This is an automatically generated test thread telling you that everything went okay when you installed the board software.', '../qb_thumbnail.png');

CREATE TABLE messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    threadid INT UNSIGNED NOT NULL,
    created DATETIME NULL DEFAULT NOW(),
    modified DATETIME NULL DEFAULT NOW(),
    points INT NOT NULL DEFAULT 0,
    message VARCHAR (1028) NOT NULL,
    filesrc VARCHAR (256) NULL DEFAULT NULL
);

INSERT INTO messages (threadid, message)
VALUES
(1, 'This is an automatically generated test response to this very specific thread on this board.\n\nIt shouldn\'t have a file attached to it.');
