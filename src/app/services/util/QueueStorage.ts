export class QueueStorage<T> {
  // An array to implement queue
  items: T[];

  constructor() {
    // declaring
    this.items = [];
  }

  // enqueue function
  enqueue(element: T) {
    // adding element to the queue
    this.items.push(element);
  }

  // dequeue function
  dequeue(): T {
    // removing element from the queue
    // returns underflow when called
    // on empty queue
    if (this.isEmpty()) {
      throw Error("no elements in queue");
    }
    return this.items.shift();
  }

  // front function
  front(): T {
    // returns the Front element of
    // the queue without removing it.
    if (this.isEmpty()) {
      throw Error("no elements in queue");
    }
    return this.items[0];
  }

  // isEmpty function
  isEmpty(): boolean {
    // return true if the queue is empty.
    return this.items.length === 0;
  }
}
