import {beforeEach, describe, expect, test} from 'bun:test'

import {contracts, resetContracts, sentimentContract} from './setup'

describe('contract: sentiment - Topic Management', () => {
    beforeEach(async () => {
        await resetContracts()
    })

    describe('action: createtopic', () => {
        describe('success', () => {
            test('create a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test topic description'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].id).toBe('testtopic')
                expect(rows[0].description).toBe('Test topic description')
            })

            test('create multiple topics', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic3', 'Third topic'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(3)
                expect(rows[0].id).toBe('topic1')
                expect(rows[1].id).toBe('topic2')
                expect(rows[2].id).toBe('topic3')
            })
        })

        describe('error', () => {
            test('duplicate topic ID', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'First description'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions
                        .createtopic(['testtopic', 'Second description'])
                        .send(sentimentContract)
                ).rejects.toThrow('eosio_assert: topic with this ID already exists')
            })

            test('missing authorization', async () => {
                await expect(
                    contracts.sentiment.actions
                        .createtopic(['testtopic', 'Test description'])
                        .send('unauthorized')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: updatetopic', () => {
        describe('success', () => {
            test('update topic description', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Original description'])
                    .send(sentimentContract)

                let rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows[0].description).toBe('Original description')

                await contracts.sentiment.actions
                    .updatetopic(['testtopic', 'Updated description'])
                    .send(sentimentContract)

                rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].id).toBe('testtopic')
                expect(rows[0].description).toBe('Updated description')
            })

            test('update does not affect topic ID', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Original description'])
                    .send(sentimentContract)

                await contracts.sentiment.actions
                    .updatetopic(['testtopic', 'New description'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows[0].id).toBe('testtopic')
            })
        })

        describe('error', () => {
            test('topic does not exist', async () => {
                await expect(
                    contracts.sentiment.actions
                        .updatetopic(['nonexistent', 'Some description'])
                        .send(sentimentContract)
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Original description'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions
                        .updatetopic(['testtopic', 'Updated description'])
                        .send('unauthorized')
                ).rejects.toThrow()
            })
        })
    })

    describe('action: deletetopic', () => {
        describe('success', () => {
            test('delete a topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test description'])
                    .send(sentimentContract)

                let rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(1)

                await contracts.sentiment.actions.deletetopic(['testtopic']).send(sentimentContract)

                rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(0)
            })

            test('delete one of multiple topics', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic3', 'Third topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.deletetopic(['topic2']).send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(2)
                expect(rows[0].id).toBe('topic1')
                expect(rows[1].id).toBe('topic3')
            })
        })

        describe('error', () => {
            test('topic does not exist', async () => {
                await expect(
                    contracts.sentiment.actions.deletetopic(['nonexistent']).send(sentimentContract)
                ).rejects.toThrow('eosio_assert: topic does not exist')
            })

            test('missing authorization', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test description'])
                    .send(sentimentContract)

                await expect(
                    contracts.sentiment.actions.deletetopic(['testtopic']).send('unauthorized')
                ).rejects.toThrow()
            })
        })
    })

    describe('read-only actions', () => {
        describe('action: gettopic', () => {
            describe('success', () => {
                test('get a single topic by id', async () => {
                    await contracts.sentiment.actions
                        .createtopic(['testtopic', 'Test description'])
                        .send(sentimentContract)

                    const topic = await contracts.sentiment.actions.gettopic(['testtopic']).read()
                    expect(String(topic.id)).toBe('testtopic')
                    expect(topic.description).toBe('Test description')
                })

                test('get correct topic from multiple', async () => {
                    await contracts.sentiment.actions
                        .createtopic(['topic1', 'First topic'])
                        .send(sentimentContract)
                    await contracts.sentiment.actions
                        .createtopic(['topic2', 'Second topic'])
                        .send(sentimentContract)
                    await contracts.sentiment.actions
                        .createtopic(['topic3', 'Third topic'])
                        .send(sentimentContract)

                    const topic = await contracts.sentiment.actions.gettopic(['topic2']).read()
                    expect(String(topic.id)).toBe('topic2')
                    expect(topic.description).toBe('Second topic')
                })
            })

            describe('error', () => {
                test('topic does not exist', async () => {
                    await expect(
                        contracts.sentiment.actions.gettopic(['nonexistent']).read()
                    ).rejects.toThrow('eosio_assert: topic does not exist')
                })
            })
        })

        describe('action: gettopics', () => {
            describe('success', () => {
                test('get all topics', async () => {
                    await contracts.sentiment.actions
                        .createtopic(['topic1', 'First topic'])
                        .send(sentimentContract)
                    await contracts.sentiment.actions
                        .createtopic(['topic2', 'Second topic'])
                        .send(sentimentContract)
                    await contracts.sentiment.actions
                        .createtopic(['topic3', 'Third topic'])
                        .send(sentimentContract)

                    const topics = await contracts.sentiment.actions.gettopics().read()
                    expect(topics).toHaveLength(3)
                    expect(String(topics[0].id)).toBe('topic1')
                    expect(topics[0].description).toBe('First topic')
                    expect(String(topics[1].id)).toBe('topic2')
                    expect(topics[1].description).toBe('Second topic')
                    expect(String(topics[2].id)).toBe('topic3')
                    expect(topics[2].description).toBe('Third topic')
                })

                test('returns empty array when no topics exist', async () => {
                    const topics = await contracts.sentiment.actions.gettopics().read()
                    expect(topics).toHaveLength(0)
                })
            })
        })
    })

    describe('read operations via table', () => {
        describe('success', () => {
            test('read a single topic', async () => {
                await contracts.sentiment.actions
                    .createtopic(['testtopic', 'Test description'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(1)
                expect(rows[0].id).toBe('testtopic')
                expect(rows[0].description).toBe('Test description')
            })

            test('read correct topic from multiple', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic3', 'Third topic'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(3)
                const topic2 = rows.find((r) => r.id === 'topic2')
                expect(topic2?.id).toBe('topic2')
                expect(topic2?.description).toBe('Second topic')
            })

            test('read all topics', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic3', 'Third topic'])
                    .send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(3)
                expect(rows[0].id).toBe('topic1')
                expect(rows[0].description).toBe('First topic')
                expect(rows[1].id).toBe('topic2')
                expect(rows[1].description).toBe('Second topic')
                expect(rows[2].id).toBe('topic3')
                expect(rows[2].description).toBe('Third topic')
            })

            test('read empty list when no topics exist', async () => {
                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(0)
            })

            test('read all topics after deletion', async () => {
                await contracts.sentiment.actions
                    .createtopic(['topic1', 'First topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic2', 'Second topic'])
                    .send(sentimentContract)
                await contracts.sentiment.actions
                    .createtopic(['topic3', 'Third topic'])
                    .send(sentimentContract)

                await contracts.sentiment.actions.deletetopic(['topic2']).send(sentimentContract)

                const rows = await contracts.sentiment.tables.topics().getTableRows()
                expect(rows).toHaveLength(2)
                expect(rows[0].id).toBe('topic1')
                expect(rows[1].id).toBe('topic3')
            })
        })
    })

    describe('integration', () => {
        test('full CRUD lifecycle', async () => {
            // Create
            await contracts.sentiment.actions
                .createtopic(['lifecycle', 'Initial description'])
                .send(sentimentContract)

            let rows = await contracts.sentiment.tables.topics().getTableRows()
            expect(rows).toHaveLength(1)
            expect(rows[0].id).toBe('lifecycle')
            expect(rows[0].description).toBe('Initial description')

            // Read (via table)
            rows = await contracts.sentiment.tables.topics().getTableRows()
            expect(rows).toHaveLength(1)
            expect(rows[0].id).toBe('lifecycle')

            // Update
            await contracts.sentiment.actions
                .updatetopic(['lifecycle', 'Updated description'])
                .send(sentimentContract)

            rows = await contracts.sentiment.tables.topics().getTableRows()
            expect(rows[0].description).toBe('Updated description')

            // Delete
            await contracts.sentiment.actions.deletetopic(['lifecycle']).send(sentimentContract)

            rows = await contracts.sentiment.tables.topics().getTableRows()
            expect(rows).toHaveLength(0)
        })
    })
})
