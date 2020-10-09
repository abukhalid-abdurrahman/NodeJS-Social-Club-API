'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = 9999;
const statusOk = 200;
const statusNotFound = 404;
const statusInternalServerError = 500;
const statusBadRequest = 400;
const schema = 'social';

const client = mysqlx.getClient({
  user: 'app',
  password: 'pass',
  host: '0.0.0.0',
  port: 33060
});

function sendResponse(response, { status = statusOk, headers = {}, body = null }) {
  Object.entries(headers).forEach(function ([key, value]) {
    response.setHeader(key, value);
  });
  response.writeHead(status);
  response.end(body);
}

function sendJSON(response, body) {
  sendResponse(response, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function map(columns) {
  return row => row.reduce((res, value, i) => ({ ...res, [columns[i].getColumnLabel()]: value }), {});
}

const methods = new Map();

methods.set('/posts.get', async ({ response, db }) => {
  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('removed=0')
    .orderBy('id DESC')
    .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));
  sendJSON(response, posts);
});


methods.set('/posts.getById', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.post', async ({ response, db, searchParams }) => {
  if (!searchParams.has('content')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const content = searchParams.get('content');

  const table = db.getTable('posts');
  const insertedPost = await table.insert('content').values(content).execute();

  const postId = insertedPost.getAutoIncrementValue();

  const getPostById = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', postId)
    .execute();

  const data = getPostById.fetchAll();
  const columns = getPostById.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === postId);
  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.edit', async ({ response, db, searchParams }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  if (!searchParams.has('content')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const content = searchParams.get('content');

  const table = db.getTable('posts');

  await table.update()
    .set('content', content)
    .where('id=:id and removed=0')
    .bind('id', id)
    .execute();


  const getPostById = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  const data = getPostById.fetchAll();
  const columns = getPostById.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.delete', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = db.getTable('posts');

  const postToDelete = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  const data = postToDelete.fetchAll();
  const columns = postToDelete.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);

  await table.update()
    .set('removed', 1)
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.restore', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = db.getTable('posts');

  const postToRestore = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=1')
    .bind('id', id)
    .execute();

  const data = postToRestore.fetchAll();
  const columns = postToRestore.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);

  await table.update()
    .set('removed', 0)
    .where('id=:id AND removed=1')
    .bind('id', id)
    .execute();

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.like', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = db.getTable('posts');

  const postToLike = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  const data = postToLike.fetchAll();
  const columns = postToLike.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  const currentLike = post.likes;
  const incrementLike = currentLike + 1;
  await table.update()
    .set('likes', incrementLike)
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  post.likes = incrementLike;

  sendJSON(response, post);
});


methods.set('/posts.dislike', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = db.getTable('posts');

  const postToLike = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=0')
    .bind('id', id)
    .execute();

  const data = postToLike.fetchAll();
  const columns = postToLike.getColumns();
  const posts = data.map(map(columns));

  const post = posts.find(o => o.id === id);

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  const currentLike = post.likes;
  if (currentLike > 0) {

    const disLike = currentLike - 1;
    await table.update()
      .set('likes', disLike)
      .where('id=:id AND removed=0')
      .bind('id', id)
      .execute();
    post.likes = disLike;
  }
  sendJSON(response, post);
});


const server = http.createServer(async (request, response) => {
  const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

  const method = methods.get(pathname);
  if (method === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  let session = null;
  try {
    session = await client.getSession();
    const db = await session.getSchema(schema);

    const params = {
      request,
      response,
      pathname,
      searchParams,
      db,
    };

    await method(params);
  } catch (e) {
    sendResponse(response, { status: statusInternalServerError });
  } finally {
    if (session !== null) {
      try {
        await session.close();
      } catch (e) {
        console.log(e);
      }
    }
  }
});

server.listen(port);
