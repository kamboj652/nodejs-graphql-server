
import { execute, subscribe } from "graphql";
import { createServer } from "http";
import express from "express";
//import { SubscriptionServer } from "subscriptions-transport-ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { PubSub } from "graphql-subscriptions";
import { graphqlHTTP } from 'express-graphql';
import http from 'http';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws'
import { GRAPHQL_TRANSPORT_WS_PROTOCOL } from 'graphql-ws';
import { SubscriptionServer, GRAPHQL_WS } from 'subscriptions-transport-ws';


// import ws from 'ws'; yarn add ws@7
// const WebSocketServer = ws.Server;


const pubsub = new PubSub();

// Construct a schema, using GraphQL schema language
const typeDefs = `
  type Post{
    author: String
    comment: String
  }

  type Query {
    hello: String
  }
  type Subscription {
    postCreated: Post
  }
  type Mutation{
    createPost(author: String, comment: String): Post
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: (root, args, context) => "Hello world!"
  },
  Mutation: {
    createPost(parent, args, context) {
      pubsub.publish('POST_CREATED', { postCreated: {
		  author: "Author",
		  comment: "Comment"
	  } });
	  console.log('createPost')
	  const newPost = {
		  author: "Author",
		  comment:"Comment"		  
	  }
      return newPost;
    }
  },
  Subscription: {
    postCreated: {
      // More on pubsub below
      subscribe: () =>  pubsub.asyncIterator(["POST_CREATED"])
	  //console.log('POST_CREATED')
	  
    }
  }
};

const schema = makeExecutableSchema({typeDefs, resolvers});



//--------------------------------------

// graphql-ws
const graphqlWs = new WebSocketServer({ noServer: true });
useServer({ schema }, graphqlWs);

// subscriptions-transport-ws
const subTransWs = new WebSocketServer({ noServer: true });
SubscriptionServer.create(
  {
    schema,
    execute,
    subscribe,
  },
  subTransWs,
);


const app = express();
app.use('/graphql', graphqlHTTP({ schema, graphiql: true }));

// builds a websocket server
// see https://github.com/enisdenjo/graphql-ws#express
const server = http.createServer(app);


// listen for upgrades and delegate requests according to the WS subprotocol
server.on('upgrade', (req, socket, head) => {
		
  // extract websocket subprotocol from header
  const protocol = req.headers['sec-websocket-protocol'];
  const protocols = Array.isArray(protocol)
    ? protocol
    : protocol?.split(',').map((p) => p.trim());

  // decide which websocket server to use
  const wss =
    protocols?.includes(GRAPHQL_WS) && // subscriptions-transport-ws subprotocol
    !protocols.includes(GRAPHQL_TRANSPORT_WS_PROTOCOL) // graphql-ws subprotocol
      ? subTransWs
      : // graphql-ws will welcome its own subprotocol and
        // gracefully reject invalid ones. if the client supports
        // both transports, graphql-ws will prevail
        graphqlWs;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(8080);


