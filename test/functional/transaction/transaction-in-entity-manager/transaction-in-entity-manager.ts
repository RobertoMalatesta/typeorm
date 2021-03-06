import "reflect-metadata";
import {createTestingConnections, closeTestingConnections, reloadTestingDatabases} from "../../../utils/test-utils";
import {Connection} from "../../../../src/connection/Connection";
import {Post} from "./entity/Post";
import {Category} from "./entity/Category";
import {expect} from "chai";

describe("transaction > transaction with entity manager", () => {

    let connections: Connection[];
    before(async () => connections = await createTestingConnections({
        entities: [__dirname + "/entity/*{.js,.ts}"],
        schemaCreate: true,
        dropSchemaOnConnection: true,
        enabledDrivers: ["mysql", "sqlite", "postgres"] // todo: for some reasons mariadb tests are not passing here
    }));
    beforeEach(() => reloadTestingDatabases(connections));
    after(() => closeTestingConnections(connections));

    it("should execute all operations in a single transaction", () => Promise.all(connections.map(async connection => {

        let postId: number|undefined = undefined, categoryId: number|undefined = undefined;

        await connection.entityManager.transaction(async entityManager => {

            const post = new Post();
            post.title = "Post #1";
            await entityManager.persist(post);

            const category = new Category();
            category.name = "Category #1";
            await entityManager.persist(category);

            postId = post.id;
            categoryId = category.id;

        });

        const post = await connection.entityManager.findOne(Post, { title: "Post #1" });
        expect(post).not.to.be.empty;
        post!.should.be.eql({
            id: postId,
            title: "Post #1"
        });

        const category = await connection.entityManager.findOne(Category, { name: "Category #1" });
        expect(category).not.to.be.empty;
        category!.should.be.eql({
            id: categoryId,
            name: "Category #1"
        });

    })));

    it("should not save anything if any of operation in transaction fail", () => Promise.all(connections.map(async connection => {

        let postId: number|undefined = undefined, categoryId: number|undefined = undefined;

        try {
            await connection.entityManager.transaction(async entityManager => {

                const post = new Post();
                post.title = "Post #1";
                await entityManager.persist(post);

                const category = new Category();
                category.name = "Category #1";
                await entityManager.persist(category);

                postId = post.id;
                categoryId = category.id;

                const loadedPost = await entityManager.findOne(Post, { title: "Post #1" });
                expect(loadedPost).not.to.be.empty;
                loadedPost!.should.be.eql({
                    id: postId,
                    title: "Post #1"
                });

                const loadedCategory = await entityManager.findOne(Category, { name: "Category #1" });
                expect(loadedCategory).not.to.be.empty;
                loadedCategory!.should.be.eql({
                    id: categoryId,
                    name: "Category #1"
                });

                // now try to save post without title - it will fail and transaction will be reverted
                const wrongPost = new Post();
                await entityManager.persist(wrongPost);

            });
        } catch (err) {
            /* skip error */
        }

        const post = await connection.entityManager.findOne(Post, { title: "Post #1" });
        expect(post).to.be.empty;

        const category = await connection.entityManager.findOne(Category, { name: "Category #1" });
        expect(category).to.be.empty;

    })));

});
